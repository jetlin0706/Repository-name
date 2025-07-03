document.addEventListener('DOMContentLoaded', () => {
    // 使用相对路径，确保API路径正确
    const apiBaseUrl = '/api/admin';
    let password = null;
    let allLicenses = {}; // Cache for licenses
    let isAuthenticated = false; // 添加认证状态标志

    // DOM Elements
    const licenseForm = document.getElementById('licenseForm');
    const licensesTableBody = document.querySelector('#licensesTable tbody');
    const generateKeyBtn = document.getElementById('generateKeyBtn');
    const licenseKeyInput = document.getElementById('licenseKey');
    const startDateInput = document.getElementById('startDate');
    const expiryDateInput = document.getElementById('expiryDate');
    const hotelNameInput = document.getElementById('hotelName');

    // Dashboard Elements
    const totalLicensesEl = document.getElementById('totalLicenses');
    const activeLicensesEl = document.getElementById('activeLicenses');
    const todayActivationsEl = document.getElementById('todayActivations');

    // 添加登录表单
    const mainContainer = document.querySelector('.container');
    const loginContainer = document.createElement('div');
    loginContainer.className = 'login-container card';
    loginContainer.innerHTML = `
        <h2>管理员登录</h2>
        <div class="form-group">
            <label for="adminPassword">管理员密码</label>
            <input type="password" id="adminPassword" placeholder="请输入管理员密码">
        </div>
        <button id="loginBtn">登录</button>
        <p id="loginMessage" class="error-message"></p>
    `;
    
    // 隐藏主要内容，显示登录表单
    function showLoginForm() {
        // 隐藏所有子元素
        Array.from(mainContainer.children).forEach(child => {
            if (child !== loginContainer) {
                child.style.display = 'none';
            }
        });
        
        // 显示登录表单
        mainContainer.prepend(loginContainer);
        document.getElementById('adminPassword').focus();
    }
    
    // 显示主要内容，隐藏登录表单
    function showMainContent() {
        loginContainer.style.display = 'none';
        Array.from(mainContainer.children).forEach(child => {
            if (child !== loginContainer) {
                child.style.display = '';
            }
        });
    }

    function getAuthHeaders() {
        if (!password) return {};
        const encoded = btoa(`:${password}`);
        return { 'Authorization': `Basic ${encoded}` };
    }

    async function fetchLicenses() {
        try {
            console.log('正在获取授权码列表...');
            const response = await fetch(`${apiBaseUrl}/licenses`, {
                method: 'GET',
                headers: getAuthHeaders()
            });

            console.log('获取授权码响应状态:', response.status);
            
            if (response.status === 401) {
                isAuthenticated = false;
                showLoginForm();
                document.getElementById('loginMessage').textContent = '密码错误或未授权，请重新登录';
                return;
            }
            
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            isAuthenticated = true;
            showMainContent();
            
            allLicenses = await response.json();
            console.log('获取到的授权码数据:', allLicenses);
            renderLicensesWithSearchAndPage();
            updateDashboard(allLicenses);

        } catch (error) {
            console.error('Error fetching licenses:', error);
            alert('获取授权码列表时出错，详情请查看控制台。');
        }
    }

    function renderLicenses(licenses) {
        licensesTableBody.innerHTML = '';
        const now = new Date();

        // Ensure licenses is an object before iterating
        if (typeof licenses !== 'object' || licenses === null) {
            console.error("Received non-object data for licenses:", licenses);
            licensesTableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;">暂无授权码数据</td></tr>';
            return;
        }

        // 如果没有授权码，显示提示信息
        if (Object.keys(licenses).length === 0) {
            licensesTableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;">暂无授权码数据</td></tr>';
            return;
        }

        for (const licenseKey in licenses) {
            let license;
            const licenseData = licenses[licenseKey];

            // This is the most robust way to handle the data
            if (typeof licenseData === 'string') {
                try {
                    license = JSON.parse(licenseData);
                } catch (e) {
                    console.error('Could not parse license data for key:', licenseKey);
                    continue; 
                }
            } else if (typeof licenseData === 'object' && licenseData !== null) {
                license = licenseData; // It's already a valid object
            } else {
                 console.error('Invalid license data type for key:', licenseKey);
                 continue;
            }

            const expiryDate = new Date(license.expiryDate);
            const isActive = now < expiryDate;
            const activations = license.activations || [];
            const lastIP = activations.length > 0 ? activations[activations.length - 1].ip : 'N/A';

            // 复制内容
            const copyText = `酒店：${license.hotelName}，AI好评回复助手激活码为：${licenseKey}，开始时间：${license.startDate || 'N/A'}，结束时间：${license.expiryDate}`;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${licenseKey}</td>
                <td>${license.hotelName}</td>
                <td>${license.startDate || 'N/A'}</td>
                <td>${license.expiryDate}</td>
                <td class="status-${isActive ? 'active' : 'expired'}">${isActive ? '有效' : '已过期'}</td>
                <td>${activations.length}</td>
                <td>${lastIP}</td>
                <td>
                  <button class="copy-btn" data-copy="${copyText}">复制</button>
                  <button class="delete-btn" data-key="${licenseKey}">删除</button>
                </td>
            `;
            licensesTableBody.appendChild(row);
        }
    }
    
    function updateDashboard(licenses) {
        // Ensure licenses is an object before iterating
        if (typeof licenses !== 'object' || licenses === null) {
            console.error("Received non-object data for licenses for dashboard:", licenses);
            totalLicensesEl.textContent = 0;
            activeLicensesEl.textContent = 0;
            todayActivationsEl.textContent = 0;
            return;
        }

        const licenseArray = Object.values(licenses).map(val => {
            if (typeof val === 'string') {
                try {
                    return JSON.parse(val);
                } catch (e) {
                    console.error('Could not parse license data in dashboard:', val);
                    return null;
                }
            } else if (typeof val === 'object' && val !== null) {
                return val;
            }
            return null;
        }).filter(Boolean); // Filter out nulls from parsing errors
        
        const now = new Date();
        const today = now.toISOString().split('T')[0];

        const total = licenseArray.length;
        const active = licenseArray.filter(l => new Date(l.expiryDate) > now).length;
        
        const todayActivations = licenseArray.reduce((count, license) => {
            const activationsToday = (license.activations || []).filter(act => act.timestamp.startsWith(today)).length;
            return count + activationsToday;
        }, 0);

        totalLicensesEl.textContent = total;
        activeLicensesEl.textContent = active;
        todayActivationsEl.textContent = todayActivations;
    }

    async function saveLicense(event) {
        event.preventDefault();
        
        if (!isAuthenticated) {
            alert('请先登录');
            showLoginForm();
            return;
        }
        
        if (!licenseKeyInput.value.trim()) {
            alert('请输入授权码');
            return;
        }
        
        if (!hotelNameInput.value.trim()) {
            alert('请输入酒店名称');
            return;
        }
        
        const licenseData = {
            licenseKey: licenseKeyInput.value.trim(),
            hotelName: hotelNameInput.value.trim(),
            startDate: startDateInput.value,
            expiryDate: expiryDateInput.value
        };

        try {
            console.log('保存授权码数据:', licenseData);
            const response = await fetch(`${apiBaseUrl}/licenses`, {
                method: 'POST',
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify(licenseData)
            });

            console.log('保存授权码响应状态:', response.status);
            
            if (response.status === 401) {
                isAuthenticated = false;
                showLoginForm();
                return;
            }
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.message || 'Unknown error'}`);
            }

            alert('保存成功！');
            licenseForm.reset();
            setDefaultDates();
            fetchLicenses();

        } catch (error) {
            console.error('Error saving license:', error);
            alert(`保存失败: ${error.message}`);
        }
    }

    async function deleteLicense(event) {
        if (!event.target.classList.contains('delete-btn')) return;
        
        if (!isAuthenticated) {
            alert('请先登录');
            showLoginForm();
            return;
        }

        const licenseKey = event.target.dataset.key;
        if (!confirm(`确定要删除授权码 "${licenseKey}" 吗？此操作不可撤销。`)) return;
        
        const cleanLicenseKey = licenseKey.replace(/\*/g, '');

        try {
            const response = await fetch(`${apiBaseUrl}/licenses`, {
                method: 'DELETE',
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ licenseKey: cleanLicenseKey })
            });
            
            if (response.status === 401) {
                isAuthenticated = false;
                showLoginForm();
                return;
            }
            
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            alert('删除成功！');
            fetchLicenses();

        } catch (error) {
            console.error('Error deleting license:', error);
            alert('删除失败，请查看控制台获取详情。');
        }
    }

    function generateRandomKey() {
        const prefix = "HOTEL";
        const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase();
        licenseKeyInput.value = `${prefix}-${randomPart}`;
    }

    function setDefaultDates() {
        const today = new Date();
        const oneYearLater = new Date(today);
        oneYearLater.setFullYear(today.getFullYear() + 1);
        
        startDateInput.value = today.toISOString().split('T')[0];
        expiryDateInput.value = oneYearLater.toISOString().split('T')[0];
    }

    async function login(password) {
        try {
            const response = await fetch(`${apiBaseUrl}/licenses`, {
                method: 'GET',
                headers: { 'Authorization': `Basic ${btoa(`:${password}`)}` }
            });
            
            if (response.status === 401) {
                document.getElementById('loginMessage').textContent = '密码错误，请重试';
                return false;
            }
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return true;
        } catch (error) {
            console.error('Login error:', error);
            document.getElementById('loginMessage').textContent = '登录时发生错误，请重试';
            return false;
        }
    }
    
    // 添加默认JD-FIRST-KEY授权码
    async function addDefaultLicense() {
        if (!isAuthenticated) {
            alert('请先登录');
            showLoginForm();
            return;
        }
        
        try {
            const today = new Date();
            const oneYearLater = new Date(today);
            oneYearLater.setFullYear(today.getFullYear() + 1);
            
            const licenseData = {
                licenseKey: 'JD-FIRST-KEY',
                hotelName: '默认酒店',
                startDate: today.toISOString().split('T')[0],
                expiryDate: oneYearLater.toISOString().split('T')[0]
            };
            
            console.log('添加默认授权码:', licenseData);
            const response = await fetch(`${apiBaseUrl}/licenses`, {
                method: 'POST',
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify(licenseData)
            });
            
            if (response.status === 401) {
                isAuthenticated = false;
                showLoginForm();
                return;
            }
            
            if (!response.ok) {
                console.error('添加默认授权码失败:', response.status);
                alert('添加默认授权码失败');
                return;
            }
            
            console.log('默认授权码添加成功');
            alert('默认授权码添加成功');
            fetchLicenses();
        } catch (error) {
            console.error('添加默认授权码出错:', error);
            alert('添加默认授权码出错: ' + error.message);
        }
    }
    
    // Initial setup
    licenseForm.addEventListener('submit', saveLicense);
    licensesTableBody.addEventListener('click', async function(event) {
        if (event.target.classList.contains('copy-btn')) {
            const text = event.target.getAttribute('data-copy');
            await navigator.clipboard.writeText(text);
            event.target.textContent = '已复制';
            setTimeout(() => { event.target.textContent = '复制'; }, 1200);
            return;
        }
        if (!event.target.classList.contains('delete-btn')) return;
        
        if (!isAuthenticated) {
            alert('请先登录');
            showLoginForm();
            return;
        }

        const licenseKey = event.target.dataset.key;
        if (!confirm(`确定要删除授权码 "${licenseKey}" 吗？此操作不可撤销。`)) return;
        
        const cleanLicenseKey = licenseKey.replace(/\*/g, '');

        try {
            const response = await fetch(`${apiBaseUrl}/licenses`, {
                method: 'DELETE',
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ licenseKey: cleanLicenseKey })
            });
            
            if (response.status === 401) {
                isAuthenticated = false;
                showLoginForm();
                return;
            }
            
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            alert('删除成功！');
            fetchLicenses();

        } catch (error) {
            console.error('Error deleting license:', error);
            alert('删除失败，请查看控制台获取详情。');
        }
    });
    generateKeyBtn.addEventListener('click', generateRandomKey);
    
    // 登录处理
    function handleLogin() {
        const passwordInput = document.getElementById('adminPassword');
        const enteredPassword = passwordInput.value.trim();
        
        if (!enteredPassword) {
            document.getElementById('loginMessage').textContent = '请输入密码';
            return;
        }
        
        login(enteredPassword).then(success => {
            if (success) {
                password = enteredPassword;
                isAuthenticated = true;
                showMainContent();
                fetchLicenses();
            }
        });
    }
    
    // 添加登录按钮事件监听
    function setupLoginForm() {
        const loginBtn = document.getElementById('loginBtn');
        const passwordInput = document.getElementById('adminPassword');
        
        loginBtn.addEventListener('click', handleLogin);
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleLogin();
            }
        });
    }
    
    setDefaultDates();
    showLoginForm();
    setupLoginForm();
    
    // 隐藏添加默认授权码按钮
    const addDefaultBtn = document.querySelector('button');
    if (addDefaultBtn && addDefaultBtn.textContent.includes('添加默认授权码')) {
        addDefaultBtn.style.display = 'none';
    }

    // 新增：搜索与分页相关变量
    const searchInput = document.getElementById('searchInput');
    const paginationDiv = document.getElementById('pagination');
    let filteredLicenses = {};
    let currentPage = 1;
    const PAGE_SIZE = 10;

    // 监听搜索输入
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            currentPage = 1;
            renderLicensesWithSearchAndPage();
        });
    }

    // 渲染带搜索和分页的授权码
    function renderLicensesWithSearchAndPage() {
        const keyword = searchInput ? searchInput.value.trim().toLowerCase() : '';
        // 过滤
        filteredLicenses = {};
        for (const key in allLicenses) {
            let license = allLicenses[key];
            if (typeof license === 'string') {
                try { license = JSON.parse(license); } catch { continue; }
            }
            const hotelName = (license.hotelName || '').toLowerCase();
            if (key.toLowerCase().includes(keyword) || hotelName.includes(keyword)) {
                filteredLicenses[key] = license;
            }
        }
        // 分页
        const keys = Object.keys(filteredLicenses);
        const total = keys.length;
        const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
        if (currentPage > totalPages) currentPage = totalPages;
        const startIdx = (currentPage - 1) * PAGE_SIZE;
        const pageKeys = keys.slice(startIdx, startIdx + PAGE_SIZE);
        // 构造分页数据
        const pageLicenses = {};
        for (const k of pageKeys) pageLicenses[k] = filteredLicenses[k];
        renderLicenses(pageLicenses);
        renderPagination(totalPages);
    }

    // 渲染分页栏
    function renderPagination(totalPages) {
        paginationDiv.innerHTML = '';
        if (totalPages <= 1) return;
        for (let i = 1; i <= totalPages; i++) {
            const btn = document.createElement('button');
            btn.textContent = i;
            btn.className = 'page-btn' + (i === currentPage ? ' active' : '');
            btn.onclick = () => { currentPage = i; renderLicensesWithSearchAndPage(); };
            paginationDiv.appendChild(btn);
        }
    }

    // 新增：初始渲染
    if (searchInput && paginationDiv) {
        renderLicensesWithSearchAndPage();
    }
}); 