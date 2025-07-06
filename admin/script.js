document.addEventListener('DOMContentLoaded', () => {
    // API 服务器的基础URL，直接指向新的腾讯云服务器
    const API_BASE_URL = 'http://43.142.109.130:3001/api/admin';

    let token = localStorage.getItem('authToken');

    // DOM 元素
    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');
    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginError = document.getElementById('login-error');
    const welcomeMessage = document.getElementById('welcome-message');
    const logoutButton = document.getElementById('logout-button');
    const licenseForm = document.getElementById('license-form');
    const licensesTableBody = document.querySelector('#licenses-table tbody');
    const licenseKeyInput = document.getElementById('license-key');
    const hotelNameInput = document.getElementById('hotel-name');
    const startDateInput = document.getElementById('start-date');
    const expiresAtInput = document.getElementById('expires-at');
    const generateKeyButton = document.getElementById('generate-key-btn');
    
    // 检查登录状态
    function checkLoginState() {
        if (token) {
            authContainer.style.display = 'none';
            appContainer.style.display = 'block';
            fetchAndRenderLicenses();
            fetchCurrentUser();
        } else {
            authContainer.style.display = 'block';
            appContainer.style.display = 'none';
        }
    }

    // 获取当前用户信息
    async function fetchCurrentUser() {
        if (!token) return;
        try {
            const response = await fetch(`${API_BASE_URL}/accounts/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch user');
            const data = await response.json();
            welcomeMessage.textContent = `欢迎, ${data.user.name} (${data.user.role})`;
        } catch(e) {
            console.error(e);
            logout();
        }
    }

    // API 请求函数
    async function apiRequest(endpoint, method, data = null) {
        const url = `${API_BASE_URL}/${endpoint}`;
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        };
        if (data) {
            options.body = JSON.stringify(data);
        }
        const response = await fetch(url, options);
        if (response.status === 401) {
            logout();
            throw new Error('Unauthorized');
        }
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || err.message || `API request failed: ${response.statusText}`);
        }
        return response.json();
    }

    // 渲染表格
    function renderTable(licenses) {
        licensesTableBody.innerHTML = '';
        const licenseArray = Object.entries(licenses);
        if (licenseArray.length === 0) {
            licensesTableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;">暂无授权码</td></tr>';
            return;
        }

        licenseArray.forEach(([key, license]) => {
            const isExpired = new Date(license.expiryDate) < new Date();
            const row = `
                <tr>
                    <td>${key}</td>
                    <td>${license.hotelName || ''}</td>
                    <td>${license.startDate ? new Date(license.startDate).toLocaleDateString() : ''}</td>
                    <td>${license.expiryDate ? new Date(license.expiryDate).toLocaleDateString() : ''}</td>
                    <td>
                        <span class="status ${isExpired ? 'status-expired' : 'status-valid'}">
                            ${isExpired ? '已过期' : '有效'}
                        </span>
                    </td>
                    <td>${license.activations ? license.activations.length : 0}</td>
                    <td>${license.createdBy || ''}</td>
                    <td>
                        <button class="edit-btn" data-key="${key}">编辑</button>
                        <button class="delete-btn" data-key="${key}">删除</button>
                    </td>
                </tr>
            `;
            licensesTableBody.insertAdjacentHTML('beforeend', row);
        });
    }

    // 获取并显示所有授权码
    async function fetchAndRenderLicenses() {
        try {
            const licenses = await apiRequest('licenses', 'GET');
            renderTable(licenses);
        } catch (error) {
            if (error.message !== 'Unauthorized') {
                alert(`获取授权码列表失败: ${error.message}`);
            }
        }
    }
    
    // 处理登录
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = usernameInput.value;
        const password = passwordInput.value;
        loginError.textContent = '';

        try {
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || '登录失败');
            }
            token = data.token;
            localStorage.setItem('authToken', token);
            checkLoginState();
        } catch (error) {
            loginError.textContent = error.message;
        }
    });

    // 登出
    function logout() {
        token = null;
        localStorage.removeItem('authToken');
        checkLoginState();
    }
    logoutButton.addEventListener('click', logout);

    // 生成随机授权码
    generateKeyButton.addEventListener('click', () => {
        licenseKeyInput.value = 'JD-' + [...Array(12)].map(() => Math.random().toString(36)[2]).join('').toUpperCase();
    });

    // 处理表单提交 (添加/更新)
    licenseForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            licenseKey: licenseKeyInput.value,
            hotelName: hotelNameInput.value,
            startDate: startDateInput.value,
            expiryDate: expiresAtInput.value,
        };
        try {
            await apiRequest('licenses', 'POST', data);
            licenseForm.reset();
            fetchAndRenderLicenses();
        } catch (error) {
            alert(`保存失败: ${error.message}`);
        }
    });

    // 处理编辑和删除
    licensesTableBody.addEventListener('click', async (e) => {
        const target = e.target;
        const licenseKey = target.dataset.key;

        if (!licenseKey) return;

        if (target.classList.contains('delete-btn')) {
            if (confirm(`确定要删除授权码 "${licenseKey}" 吗？`)) {
                try {
                    await apiRequest('licenses', 'DELETE', { licenseKey });
                    fetchAndRenderLicenses();
                } catch (error) {
                    alert(`删除失败: ${error.message}`);
                }
            }
        }

        if (target.classList.contains('edit-btn')) {
            const row = target.closest('tr');
            licenseKeyInput.value = row.cells[0].textContent;
            hotelNameInput.value = row.cells[1].textContent;
            startDateInput.value = row.cells[2].textContent ? new Date(row.cells[2].textContent).toISOString().split('T')[0] : '';
            expiresAtInput.value = row.cells[3].textContent ? new Date(row.cells[3].textContent).toISOString().split('T')[0] : '';
            window.scrollTo(0, 0);
        }
    });
    
    // 初始化
    checkLoginState();
}); 