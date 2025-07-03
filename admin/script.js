document.addEventListener('DOMContentLoaded', () => {
    const apiBaseUrl = '/api/admin/licenses';
    let adminPassword = null;

    // DOM 元素
    const passwordModal = document.getElementById('password-modal');
    const appContainer = document.getElementById('app-container');
    const loginButton = document.getElementById('login-button');
    const passwordInput = document.getElementById('admin-password');
    const loginError = document.getElementById('login-error');
    const licenseForm = document.getElementById('license-form');
    const licensesTableBody = document.querySelector('#licenses-table tbody');
    const licenseKeyInput = document.getElementById('license-key');
    const hotelNameInput = document.getElementById('hotel-name');
    const expiresAtInput = document.getElementById('expires-at');

    // API 请求函数
    async function apiRequest(method, data = null) {
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminPassword}`
            }
        };
        if (data) {
            options.body = JSON.stringify(data);
        }
        const response = await fetch(apiBaseUrl, options);
        if (!response.ok) {
            throw new Error(`API request failed: ${response.statusText}`);
        }
        return response.json();
    }

    // 渲染表格
    function renderTable(licenses) {
        licensesTableBody.innerHTML = '';
        if (!licenses || licenses.length === 0) {
            licensesTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">暂无授权码</td></tr>';
            return;
        }

        licenses.forEach(license => {
            const isExpired = new Date(license.expiresAt) < new Date();
            const row = `
                <tr>
                    <td>${license.licenseKey}</td>
                    <td>${license.hotelName}</td>
                    <td>${license.expiresAt}</td>
                    <td>
                        <span class="status ${isExpired ? 'status-expired' : 'status-valid'}">
                            ${isExpired ? '已过期' : '有效'}
                        </span>
                    </td>
                    <td>
                        <button class="edit-btn" data-key="${license.licenseKey}">编辑</button>
                        <button class="delete-btn" data-key="${license.licenseKey}">删除</button>
                    </td>
                </tr>
            `;
            licensesTableBody.insertAdjacentHTML('beforeend', row);
        });
    }

    // 获取并显示所有授权码
    async function fetchAndRenderLicenses() {
        try {
            const licenses = await apiRequest('GET');
            renderTable(licenses);
        } catch (error) {
            console.error('Failed to fetch licenses:', error);
            alert('获取授权码列表失败，请检查密码或网络连接。');
        }
    }

    // 处理登录
    loginButton.addEventListener('click', () => {
        const password = passwordInput.value;
        if (!password) {
            loginError.textContent = '密码不能为空';
            return;
        }
        adminPassword = password;
        passwordModal.style.display = 'none';
        appContainer.style.display = 'block';
        fetchAndRenderLicenses();
    });
    passwordInput.addEventListener('keyup', (e) => {
        if(e.key === 'Enter') loginButton.click();
    })


    // 处理表单提交 (添加/更新)
    licenseForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            licenseKey: licenseKeyInput.value,
            hotelName: hotelNameInput.value,
            expiresAt: expiresAtInput.value,
        };
        try {
            await apiRequest('POST', data);
            licenseForm.reset();
            fetchAndRenderLicenses();
        } catch (error) {
            console.error('Failed to save license:', error);
            alert('保存失败，请重试。');
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
                    await apiRequest('DELETE', { licenseKey });
                    fetchAndRenderLicenses();
                } catch (error) {
                    console.error('Failed to delete license:', error);
                    alert('删除失败，请重试。');
                }
            }
        }

        if (target.classList.contains('edit-btn')) {
            const row = target.closest('tr');
            licenseKeyInput.value = row.cells[0].textContent;
            hotelNameInput.value = row.cells[1].textContent;
            expiresAtInput.value = row.cells[2].textContent;
            window.scrollTo(0, 0);
        }
    });
}); 