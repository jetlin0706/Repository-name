document.addEventListener('DOMContentLoaded', () => {
    // [FIX] Inject a high-priority CSS rule to reliably control component visibility.
    const style = document.createElement('style');
    style.textContent = '.component-hidden { display: none !important; }';
    document.head.append(style);

    console.log('初始化管理后台脚本...');
    
    // --- 全局变量和DOM元素定义 ---
    const apiBaseUrl = '/api/admin';
    let jwtToken = localStorage.getItem('token');
    let allLicenses = {};
    let allAccounts = [];
    let currentFilteredKeys = []; // 用于存储当前筛选和排序后的keys
    let currentPage = 1;
    const rowsPerPage = 10;
    let currentUser = null;

    const loginContainer = document.getElementById('loginContainer');
    const loginUsername = document.getElementById('loginUsername');
    const loginPassword = document.getElementById('loginPassword');
    const loginBtn = document.getElementById('loginBtn');
    const loginMessage = document.getElementById('loginMessage');

    const mainContent = document.getElementById('mainContent');
    const userInfo = document.getElementById('userInfo');
    const usernameDisplay = document.getElementById('usernameDisplay');
    const userRoleDisplay = document.getElementById('userRoleDisplay');
    const logoutBtn = document.getElementById('logoutBtn');

    const navLinks = {
        dashboard: document.getElementById('nav-dashboard'),
        licenses: document.getElementById('nav-licenses'),
        accounts: document.getElementById('nav-accounts'),
    };

    const containers = {
        dashboard: document.getElementById('dashboardContainer'),
        licenses: document.getElementById('licensesContainer'),
        accounts: document.getElementById('accountsContainer'),
    };
    
    const licensesTableBody = document.getElementById('licensesTableBody');
    const accountsTableBody = document.getElementById('accountsTableBody');

    const licenseKeyInput = document.getElementById('licenseKey');
    const hotelNameInput = document.getElementById('hotelName');
    const startDateInput = document.getElementById('startDate');
    const expiryDateInput = document.getElementById('expiryDate');
    const generateKeyBtn = document.getElementById('generateKeyBtn');
    const saveKeyBtn = document.getElementById('saveKeyBtn');
    const clearFormBtn = document.getElementById('clearFormBtn');
    const searchLicenseInput = document.getElementById('searchLicense');
    const paginationContainer = document.getElementById('paginationContainer');

    const savePartnerBtn = document.getElementById('savePartnerBtn');

    // --- 核心认证流程 ---
    const showLogin = () => {
        mainContent.classList.add('hidden');
        loginContainer.classList.remove('hidden');
    };

    const showMainContent = (user) => {
        loginContainer.classList.add('hidden');
        mainContent.classList.remove('hidden');
        userInfo.classList.remove('hidden');
        usernameDisplay.textContent = user.name || user.username;
        userRoleDisplay.textContent = user.role === 'admin' ? '超级管理员' : '合作伙伴';
    };

    const initializeSession = (token, user) => {
        localStorage.setItem('token', token);
        jwtToken = token;
        currentUser = user;

        // --- 权限控制 ---
        if (user.role !== 'admin') {
            navLinks.accounts.classList.add('component-hidden'); // 使用高优先级CSS类来隐藏
        } else {
            navLinks.accounts.classList.remove('component-hidden');
        }
        // --- 权限控制结束 ---

        showMainContent(user);
        switchView('dashboard'); // 默认视图
    };
    
    const checkInitialAuth = async () => {
        if (!jwtToken) {
            showLogin();
            return;
        }
        try {
            const response = await fetch(`${apiBaseUrl}/verify-token`, {
                headers: { 'Authorization': `Bearer ${jwtToken}` },
            });
            if (response.ok) {
                const data = await response.json();
                if (data.valid) {
                    initializeSession(jwtToken, data.user);
                } else {
                    logout();
                }
            } else {
                logout();
            }
        } catch (error) {
            console.error('Token verification failed:', error);
            logout();
        }
    };

    const login = async () => {
        const username = loginUsername.value.trim();
        const password = loginPassword.value.trim();
        if (!username || !password) {
            loginMessage.textContent = '请输入用户名和密码';
            return;
        }
        try {
            const response = await fetch(`${apiBaseUrl}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            const data = await response.json();
            if (response.ok) {
                loginMessage.textContent = '';
                initializeSession(data.token, data.user);
            } else {
                loginMessage.textContent = data.error || '登录失败';
            }
        } catch (error) {
            loginMessage.textContent = '登录请求失败，请检查网络';
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        jwtToken = null;
        showLogin();
    };

    // --- 视图切换 ---
    const switchView = (view) => {
        Object.values(containers).forEach(c => c.classList.add('hidden'));
        Object.values(navLinks).forEach(l => l.classList.remove('active'));
        
        containers[view]?.classList.remove('hidden');
        navLinks[view]?.classList.add('active');

        // 根据视图获取数据
        if (view === 'dashboard') fetchAndRenderDashboard();
        if (view === 'licenses') fetchAndRenderLicenses();
        if (view === 'accounts') fetchAndRenderAccounts();
    };

    // --- 数据获取与渲染 ---
    const fetchWithAuth = async (url, options = {}) => {
        const headers = { ...options.headers, 'Authorization': `Bearer ${jwtToken}` };
        const response = await fetch(url, { ...options, headers });
        if (response.status === 401) {
            logout();
            throw new Error('Unauthorized');
        }
        return response;
    };
    
    const fetchAndRenderDashboard = async () => {
        try {
            const response = await fetchWithAuth(`${apiBaseUrl}/dashboard`);
            const data = await response.json();
            document.getElementById('totalLicenses').textContent = data.totalLicenses;
            document.getElementById('activeLicenses').textContent = data.activatedCount;
            document.getElementById('todayActivations').textContent = data.todayActivations;
        } catch (error) {
            console.error('获取仪表盘数据失败:', error);
        }
    };
    
    const fetchAndRenderLicenses = async () => {
        try {
            const response = await fetchWithAuth(`${apiBaseUrl}/licenses`);
            allLicenses = await response.json();
            filterAndRenderLicenses(); // 使用新函数来处理渲染
        } catch (error) {
            console.error('获取授权码列表失败:', error);
        }
    };
    
    const renderLicenses = () => {
        if (!licensesTableBody) return;
        licensesTableBody.innerHTML = '';
        
        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        const pageKeys = currentFilteredKeys.slice(startIndex, endIndex);

        for (const key of pageKeys) {
            const license = allLicenses[key];
            const now = new Date();
            const expiry = license.expiryDate ? new Date(license.expiryDate) : null;
            
            // 状态处理
            let statusText = license.status || '未知';
            let statusClass = 'status-unknown';
            if (expiry && expiry < now) {
                statusText = '已过期';
                statusClass = 'status-expired';
            } else if (statusText === '有效') {
                statusClass = 'status-active';
            } else if (statusText === '已激活') {
                statusClass = 'status-activated';
            }

            const expiryDateStr = expiry ? expiry.toLocaleDateString() : 'N/A';
            const creationDateStr = license.createdTime ? new Date(license.createdTime).toLocaleDateString() : 'N/A';
            let ipAddress = license.lastActivationIp || 'N/A';
            if (ipAddress.startsWith('::ffff:')) {
                ipAddress = ipAddress.substring(7);
            }

            const row = `
                <tr>
                    <td>${key}</td>
                    <td>${license.hotelName || 'N/A'}</td>
                    <td><span class="${statusClass}">${statusText}</span></td>
                    <td>${license.activationCount || 0}</td>
                    <td>${license.creator || 'N/A'}</td>
                    <td>${creationDateStr}</td>
                    <td>${expiryDateStr}</td>
                    <td>${ipAddress}</td>
                    <td class="actions">
                        <button class="btn-sm" data-action="copy" data-key="${key}">复制</button>
                        <button class="btn-sm danger" data-action="delete" data-key="${key}">删除</button>
                    </td>
                </tr>`;
            licensesTableBody.innerHTML += row;
        }
    };

    const renderPagination = () => {
        if (!paginationContainer) return;
        paginationContainer.innerHTML = '';
        const totalPages = Math.ceil(currentFilteredKeys.length / rowsPerPage);
        if (totalPages <= 1) return;

        const createButton = (text, page, isDisabled = false, isActive = false) => {
            const button = document.createElement('button');
            button.textContent = text;
            button.disabled = isDisabled;
            if (isActive) button.classList.add('active');
            button.addEventListener('click', () => {
                currentPage = page;
                renderLicenses();
                renderPagination();
            });
            return button;
        };

        // 上一页按钮
        paginationContainer.appendChild(createButton('上一页', currentPage - 1, currentPage === 1));

        // 页码按钮 (最多显示5个)
        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, currentPage + 2);

        if (currentPage <= 3) {
            endPage = Math.min(5, totalPages);
        }
        if (currentPage > totalPages - 3) {
            startPage = Math.max(1, totalPages - 4);
        }

        if (startPage > 1) {
            paginationContainer.appendChild(createButton(1, 1));
            if (startPage > 2) paginationContainer.appendChild(createButton('...', startPage - 1));
        }

        for (let i = startPage; i <= endPage; i++) {
            paginationContainer.appendChild(createButton(i, i, false, i === currentPage));
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) paginationContainer.appendChild(createButton('...', endPage + 1));
            paginationContainer.appendChild(createButton(totalPages, totalPages));
        }
        
        // 下一页按钮
        paginationContainer.appendChild(createButton('下一页', currentPage + 1, currentPage === totalPages));
    };

    const fetchAndRenderAccounts = async () => {
         try {
            const response = await fetchWithAuth(`${apiBaseUrl}/accounts`);
            allAccounts = await response.json();
            renderAccounts(allAccounts);
        } catch (error) {
            console.error('获取账号列表失败:', error);
        }
    };

    const renderAccounts = (accounts) => {
        if (!accountsTableBody) return;
        accountsTableBody.innerHTML = '';
        accounts.forEach(account => {
            const createdAt = account.createdAt ? new Date(account.createdAt).toLocaleDateString() : 'N/A';
            const row = `
                <tr>
                    <td>${account.name}</td>
                    <td>${account.username}</td>
                    <td>${account.hotelCount || 0}</td>
                    <td>${createdAt}</td>
                    <td class="actions">
                        ${account.username !== 'admin' ? `<button class="btn-sm danger" data-action="delete" data-username="${account.username}">删除</button>` : ''}
                    </td>
                </tr>`;
            accountsTableBody.innerHTML += row;
        });
    };

    // --- 授权码表单与操作 ---
    const filterAndRenderLicenses = () => {
        const searchTerm = searchLicenseInput.value.toLowerCase();
        
        let filteredKeys = Object.keys(allLicenses).filter(key => {
            const license = allLicenses[key];
            return key.toLowerCase().includes(searchTerm) || 
                   (license.hotelName && license.hotelName.toLowerCase().includes(searchTerm));
        });

        // 排序
        currentFilteredKeys = filteredKeys.sort((a, b) => (allLicenses[b].createdTime || '').localeCompare(allLicenses[a].createdTime || ''));
        
        currentPage = 1; // 重置到第一页
        renderLicenses();
        renderPagination();
    };

    const clearLicenseForm = () => {
        licenseKeyInput.value = '';
        hotelNameInput.value = '';
        startDateInput.value = '';
        expiryDateInput.value = '';
        licenseKeyInput.readOnly = false;
    };

    const generateLicenseKey = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        licenseKeyInput.value = 'HOTEL-' + Array.from({length: 10}, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
        const formatDate = (date) => date.toISOString().split('T')[0];
        const today = new Date();
        const oneYearLater = new Date(new Date().setFullYear(today.getFullYear() + 1));
        startDateInput.value = formatDate(today);
        expiryDateInput.value = formatDate(oneYearLater);
    };

    const saveLicense = async () => {
        const payload = {
            key: licenseKeyInput.value.trim(),
            hotelName: hotelNameInput.value.trim(),
            startDate: startDateInput.value,
            expiryDate: expiryDateInput.value,
        };
        if (!payload.hotelName || !payload.startDate || !payload.expiryDate) {
            return alert('请填写酒店名称和起止日期！');
        }
        try {
            const response = await fetchWithAuth(`${apiBaseUrl}/licenses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error((await response.json()).message);
            alert('授权码已保存');
            clearLicenseForm();
            fetchAndRenderLicenses();
        } catch (error) {
            alert(`保存失败: ${error.message || '未知错误'}`);
        }
    };

    const editLicense = (key) => {
        const license = allLicenses[key];
        if (!license) return;
        const formatDate = (dateStr) => dateStr ? new Date(dateStr).toISOString().split('T')[0] : '';
        licenseKeyInput.value = key;
        licenseKeyInput.readOnly = true;
        hotelNameInput.value = license.hotelName;
        startDateInput.value = formatDate(license.startDate);
        expiryDateInput.value = formatDate(license.expiryDate);
        document.querySelector('#licensesContainer .form-container').scrollIntoView({ behavior: 'smooth' });
    };

    const copyLicenseInfo = (key) => {
        const license = allLicenses[key];
        if (!license) return;

        const expiryDateStr = license.expiryDate ? new Date(license.expiryDate).toLocaleDateString() : 'N/A';
        const statusText = license.status || '未知';
        const textToCopy = `酒店名称: ${license.hotelName}\n授权码: ${key}\n到期时间: ${expiryDateStr}\n状态: ${statusText}`;
        
        // 优先使用 Clipboard API (仅在 https 或 localhost 环境下可用)
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(textToCopy).then(() => {
                showCopySuccess(key);
            }).catch(err => {
                console.error('使用 Clipboard API 复制失败:', err);
                fallbackCopyTextToClipboard(textToCopy, key); // 失败时尝试后备方法
            });
        } else {
            // 使用后备方法
            fallbackCopyTextToClipboard(textToCopy, key);
        }
    };

    const fallbackCopyTextToClipboard = (text, key) => {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        
        // 避免在屏幕上闪烁
        textArea.style.position = "fixed";
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.opacity = "0";

        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            const successful = document.execCommand('copy');
            if (successful) {
                showCopySuccess(key);
            } else {
                console.error('后备方法复制失败');
                alert('复制失败!');
            }
        } catch (err) {
            console.error('后备方法复制异常:', err);
            alert('复制失败!');
        }

        document.body.removeChild(textArea);
    };

    const showCopySuccess = (key) => {
        const button = licensesTableBody.querySelector(`button[data-action="copy"][data-key="${key}"]`);
        if (button) {
            const originalText = button.textContent;
            button.textContent = '已复制!';
            button.disabled = true;
            setTimeout(() => {
                button.textContent = originalText;
                button.disabled = false;
            }, 2000);
        }
    };

    const deleteLicense = async (key) => {
        if (!confirm(`确定要删除授权码 ${key} 吗？`)) return;
        try {
            const response = await fetchWithAuth(`${apiBaseUrl}/licenses/${key}`, { method: 'DELETE' });
            if (!response.ok) throw new Error((await response.json()).message);
            alert('删除成功');
            fetchAndRenderLicenses();
        } catch (error) {
            alert(`删除失败: ${error.message || '未知错误'}`);
        }
    };

    // --- 合作伙伴管理 ---
    const partnerUsernameInput = document.getElementById('partnerUsername');
    const partnerNameInput = document.getElementById('partnerName');
    const partnerPasswordInput = document.getElementById('partnerPassword');
    const savePartner = async () => {
        const payload = {
            username: partnerUsernameInput.value.trim(),
            name: partnerNameInput.value.trim(),
            password: partnerPasswordInput.value.trim(),
        };
        if (!payload.username || !payload.name || !payload.password) return alert('请填写合作伙伴所有字段！');
        try {
            const response = await fetchWithAuth(`${apiBaseUrl}/accounts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!response.ok) throw new Error((await response.json()).message);
            alert('合作伙伴已保存');
            partnerUsernameInput.value = ''; partnerNameInput.value = ''; partnerPasswordInput.value = '';
            fetchAndRenderAccounts();
        } catch(error) { alert(`保存失败: ${error.message || '未知错误'}`); }
    };

    const resetPassword = async (username) => {
        const newPassword = prompt(`请输入为 "${username}" 设置的新密码:`);
        if (!newPassword) return;
        try {
            const response = await fetchWithAuth(`${apiBaseUrl}/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, newPassword })
            });
            if (!response.ok) throw new Error((await response.json()).message);
            alert('密码重置成功！');
        } catch (error) {
            alert(`操作失败: ${error.message || '未知错误'}`);
        }
    };

    const deleteAccount = async (username) => {
        if (username === 'admin') {
            alert('不能删除主管理员账号');
            return;
        }
        if (!confirm(`确定要删除合作伙伴 ${username} 吗？`)) return;
        try {
            const response = await fetchWithAuth(`${apiBaseUrl}/accounts/${username}`, { method: 'DELETE' });
            if (!response.ok) throw new Error((await response.json()).message);
            alert('用户删除成功！');
            fetchAndRenderAccounts();
        } catch (error) {
            console.error('删除账号失败:', error);
            alert('删除账号失败');
        }
    };

    // --- 事件绑定 ---
    loginBtn?.addEventListener('click', login);
    logoutBtn?.addEventListener('click', logout);
    Object.entries(navLinks).forEach(([viewName, link]) => {
        link?.addEventListener('click', (e) => {
            e.preventDefault();
            switchView(viewName);
        });
    });

    searchLicenseInput?.addEventListener('input', filterAndRenderLicenses);

    generateKeyBtn?.addEventListener('click', generateLicenseKey);
    saveKeyBtn?.addEventListener('click', saveLicense);
    clearFormBtn?.addEventListener('click', clearLicenseForm);

    licensesTableBody?.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            const action = e.target.dataset.action;
            const key = e.target.dataset.key;
            if (action === 'edit') editLicense(key);
            if (action === 'copy') copyLicenseInfo(key);
            if (action === 'delete') deleteLicense(key);
        }
    });

    accountsTableBody?.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            const action = e.target.dataset.action;
            const username = e.target.dataset.username;
            if (action === 'reset-password') resetPassword(username);
            if (action === 'delete') deleteAccount(username);
        }
    });

    savePartnerBtn?.addEventListener('click', savePartner);

    // --- 页面启动 ---
    checkInitialAuth();

    // 根据当前登录用户设置UI
    const setupUI = (user) => {
        currentUser = user;
        document.getElementById('usernameDisplay').textContent = `${user.name} (${user.role})`;
        loginContainer.classList.add('hidden');
        mainContent.classList.remove('hidden');

        // 根据角色显示/隐藏菜单
        if (user.role === 'admin') {
            document.querySelector('nav a[href="#accounts"]').parentElement.style.display = 'block';
        } else {
            document.querySelector('nav a[href="#accounts"]').parentElement.style.display = 'none';
        }
        
        // 渲染初始页面
        const currentHash = window.location.hash || '#dashboard';
        switchView(currentHash);
        
        // 为导航链接添加事件监听
        document.querySelectorAll('nav a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                switchView(e.target.hash);
            });
        });

        // 绑定搜索事件
        if(searchLicenseInput) {
            searchLicenseInput.addEventListener('input', filterAndRenderLicenses);
        }
    };
}); 