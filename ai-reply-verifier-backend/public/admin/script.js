document.addEventListener('DOMContentLoaded', () => {
    console.log('初始化管理后台脚本...');
    
    // 立即检查登录状态
    checkLoginStatus();
    
    // 配置API基础URL
    const hostname = window.location.hostname;
    let apiBaseUrl;
    
    if (hostname.includes('github.io')) {
        // GitHub Pages环境 - 使用Cloudflare Worker代理
        apiBaseUrl = 'https://ai-reply-proxy-new.jetlin0706.workers.dev/api/admin';
        console.log('GitHub Pages环境，使用Cloudflare代理API:', apiBaseUrl);
    } else if (hostname.includes('vercel.app')) {
        // Vercel环境
        apiBaseUrl = '/api/admin';
        console.log('Vercel环境，使用相对路径');
    } else {
        // 本地开发环境
        apiBaseUrl = '/api/admin';
        console.log('本地开发环境，使用相对路径');
    }
    
    console.log('当前API基础URL:', apiBaseUrl);
    
    let password = null;
    let allLicenses = {}; // Cache for licenses
    let isAuthenticated = false; // 添加认证状态标志
    let currentUser = null;
    
    // 新版多角色登录相关变量
    let jwtToken = localStorage.getItem('token');
    const loginContainer = document.getElementById('loginContainer');
    let loginUsername = document.getElementById('loginUsername');
    let loginPassword = document.getElementById('loginPassword');
    let loginBtn = document.getElementById('loginBtn');
    let loginMessage = document.getElementById('loginMessage');

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
    let agentStatsContainer = document.getElementById('agentStatsContainer');
    if (!agentStatsContainer) {
        agentStatsContainer = document.createElement('div');
        agentStatsContainer.id = 'agentStatsContainer';
        agentStatsContainer.style.marginTop = '16px';
        document.getElementById('dashboard').appendChild(agentStatsContainer);
    }

    // 获取主容器
    const mainContainer = document.querySelector('.container');
    // 创建旧版登录容器的引用
    let oldLoginContainer = null;

    // 登录状态检查函数
    async function checkLoginStatus() {
        const token = localStorage.getItem('token');
        if (!token) {
            console.log('未检测到登录token，显示登录表单');
            showLoginForm();
            return false;
        }

        try {
            // 验证token有效性
            const response = await fetch(`${apiBaseUrl}/verify-token`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Token验证失败');
            }

            const data = await response.json();
            if (data.valid) {
                console.log('Token有效，保持登录状态');
                currentUser = data.user;
                showMainContent();
                updateUserInfo();
                return true;
            } else {
                throw new Error('Token已过期');
            }
        } catch (error) {
            console.error('Token验证出错:', error);
            localStorage.removeItem('token');
            showLoginForm();
            return false;
        }
    }

    // 更新用户信息显示
    function updateUserInfo() {
        const userInfo = document.getElementById('userInfo');
        const welcomeText = document.getElementById('welcomeText');
        if (currentUser && userInfo && welcomeText) {
            userInfo.style.display = 'flex';
            welcomeText.textContent = `欢迎，${currentUser.name || currentUser.username}`;
        }
    }

    // 登出函数
    function logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('mock_token');
        currentUser = null;
        showLoginForm();
    }

    // 添加登出按钮事件监听
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    // 隐藏主要内容，显示登录表单
    function showLoginForm() {
        console.log('显示登录表单');
        // 显示内置登录表单
        if (loginContainer) {
            loginContainer.style.display = 'block';
            // 隐藏其他内容
            Array.from(mainContainer.children).forEach(child => {
                if (child !== loginContainer) {
                    child.style.display = 'none';
                }
            });
            if (loginUsername) loginUsername.focus();
            return;
        }
        
        // 旧版兼容，使用创建的登录表单
        if (!oldLoginContainer) {
            oldLoginContainer = document.createElement('div');
            oldLoginContainer.className = 'login-container card';
            oldLoginContainer.innerHTML = `
                <h2>管理员登录</h2>
                <div class="form-group">
                    <label for="adminPassword">管理员密码</label>
                    <input type="password" id="adminPassword" placeholder="请输入管理员密码">
                </div>
                <button id="loginBtn">登录</button>
                <p id="loginMessage" class="error-message"></p>
            `;
            mainContainer.prepend(oldLoginContainer);
        } else {
            oldLoginContainer.style.display = 'block';
        }
        
        // 隐藏所有子元素
        Array.from(mainContainer.children).forEach(child => {
            if (child !== oldLoginContainer) {
                child.style.display = 'none';
            }
        });
        
        const adminPassword = document.getElementById('adminPassword');
        if (adminPassword) adminPassword.focus();
    }
    
    // 显示主要内容，隐藏登录表单
    function showMainContent() {
        console.log('显示主内容');
        if (loginContainer) {
            loginContainer.style.display = 'none';
        }
        
        if (oldLoginContainer) {
            oldLoginContainer.style.display = 'none';
        }
        
        Array.from(mainContainer.children).forEach(child => {
            if (child !== loginContainer && child !== oldLoginContainer) {
                child.style.display = '';
            }
        });
    }

    function getAuthHeaders() {
        if (jwtToken) {
            return { 'Authorization': `Bearer ${jwtToken}` };
        }
        // 检查模拟token
        const mockToken = localStorage.getItem('mock_token');
        if (mockToken) {
            return { 'Authorization': `Bearer ${mockToken}` };
        }
        if (!password) return {};
        const encoded = btoa(`:${password}`);
        return { 'Authorization': `Basic ${encoded}` };
    }

    // 封装fetch，自动处理401和网络错误
    async function apiFetch(url, options = {}) {
        let retries = 2; // 重试次数
        let lastError = null;
        
        // 检查是否使用模拟模式
        const mockToken = localStorage.getItem('mock_token');
        if (mockToken && url.includes('/api/admin')) {
            console.log('使用模拟数据模式');
            
            // 模拟licenses接口
            if (url.includes('/licenses')) {
                if (options.method === 'GET') {
                    console.log('返回模拟授权码数据');
                    // 返回模拟的授权码数据
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({
                            "JD-FIRST-KEY": JSON.stringify({
                                hotelName: "示例酒店",
                                startDate: "2023-01-01",
                                expiryDate: "2099-12-31",
                                createdBy: "admin",
                                creatorName: "超级管理员",
                                activations: [
                                    { ip: "127.0.0.1", timestamp: new Date().toISOString() }
                                ]
                            }),
                            "DEMO-KEY": JSON.stringify({
                                hotelName: "演示酒店",
                                startDate: "2023-06-01",
                                expiryDate: "2099-12-31", 
                                createdBy: "admin",
                                creatorName: "超级管理员",
                                activations: []
                            })
                        })
                    };
                } else if (options.method === 'POST') {
                    console.log('模拟添加授权码');
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({ success: true })
                    };
                } else if (options.method === 'DELETE') {
                    console.log('模拟删除授权码');
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({ success: true })
                    };
                }
            }
            
            // 模拟dashboard接口
            if (url.includes('/dashboard')) {
                console.log('返回模拟仪表盘数据');
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        total: 2,
                        active: 2,
                        todayActivations: 1,
                        period: 'month',
                        agentStats: [
                            {
                                username: 'agent1',
                                name: '代理商A',
                                licenseCount: 10,
                                activeCount: 8,
                                todayActivations: 2,
                                trend: 5
                            },
                            {
                                username: 'agent2',
                                name: '代理商B',
                                licenseCount: 5,
                                activeCount: 4,
                                todayActivations: 1,
                                trend: -2
                            }
                        ]
                    })
                };
            }
            
            // 模拟accounts接口
            if (url.includes('/accounts')) {
                if (options.method === 'GET') {
                    console.log('返回模拟账号数据');
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({
                            accounts: [
                                {
                                    username: 'admin',
                                    name: '超级管理员',
                                    role: 'admin',
                                    createdAt: '2023-01-01T00:00:00Z'
                                },
                                {
                                    username: 'agent1',
                                    name: '代理商A',
                                    role: 'agent',
                                    createdAt: '2023-02-15T00:00:00Z'
                                }
                            ]
                        })
                    };
                }
            }
            
            // 对于其他API，返回成功但无数据
            console.log('返回通用模拟响应');
            return {
                ok: true,
                status: 200,
                json: async () => ({ success: true })
            };
        }
        
        // 正常API请求处理
        while (retries >= 0) {
            try {
                const headers = options.headers || {};
                options.headers = { ...headers, ...getAuthHeaders() };
                
                console.log(`请求API: ${url}`, options);
                const resp = await fetch(url, options);
                console.log(`API响应状态: ${resp.status}`);
                
                if (resp.status === 401) {
                    // 清除token
                    localStorage.removeItem('token');
                    localStorage.removeItem('mock_token');
                    jwtToken = null;
                    isAuthenticated = false;
                    currentUser = null;
                    
                    showLoginForm();
                    if (loginMessage) {
                        loginMessage.textContent = '登录已过期，请重新登录';
                    } else if (document.getElementById('loginMessage')) {
                        document.getElementById('loginMessage').textContent = '登录已过期，请重新登录';
                    }
                    throw new Error('401 Unauthorized');
                }
                return resp;
            } catch (error) {
                console.error(`API请求失败: ${url}`, error);
                lastError = error;
                
                // 只有在网络错误时尝试重试，其他错误直接抛出
                if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                    console.log(`请求失败，剩余重试次数: ${retries}`);
                    if (retries > 0) {
                        retries--;
                        await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒后重试
                        continue;
                    }
                }
                throw error;
            }
        }
        throw lastError; // 所有重试都失败了
    }

    // 获取仪表盘数据
    async function fetchDashboard() {
        try {
            console.log('获取仪表盘数据...');
            const resp = await apiFetch(`${apiBaseUrl}/dashboard`);
            if (resp.ok) {
                const data = await resp.json();
                console.log('仪表盘数据:', data);
                updateDashboardStats(data);
            }
        } catch (error) {
            console.error('获取仪表盘数据失败:', error);
        }
    }

    async function fetchLicenses() {
        try {
            console.log('正在获取授权码列表...');
            const response = await apiFetch(`${apiBaseUrl}/licenses`);

            console.log('获取授权码响应状态:', response.status);

            isAuthenticated = true;
            showMainContent();

            allLicenses = await response.json();
            console.log('获取到的授权码数据:', allLicenses);
            renderLicensesWithSearchAndPage();
            updateDashboard(allLicenses);

        } catch (error) {
            console.error('Error fetching licenses:', error);
            // 不显示alert，避免重复提示
        }
    }

    function renderLicenses(licenses) {
        licensesTableBody.innerHTML = '';
        const now = new Date();

        // Ensure licenses is an object before iterating
        if (typeof licenses !== 'object' || licenses === null) {
            console.error("Received non-object data for licenses:", licenses);
            licensesTableBody.innerHTML = '<tr><td colspan="9" style="text-align:center;">暂无授权码数据</td></tr>';
            return;
        }

        // 如果没有授权码，显示提示信息
        if (Object.keys(licenses).length === 0) {
            licensesTableBody.innerHTML = '<tr><td colspan="9" style="text-align:center;">暂无授权码数据</td></tr>';
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
            
            // 显示创建人
            const createdBy = license.createdBy || 'N/A';
            const creatorDisplay = createdBy === 'admin' ? '超级管理员' : 
                                  (license.creatorName || createdBy);

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
                <td>${creatorDisplay}</td>
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
            agentStatsContainer.innerHTML = '';
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
        updateDashboardStats({ total, active, todayActivations });
    }

    function updateDashboardStats(data) {
        totalLicensesEl.textContent = data.total || 0;
        activeLicensesEl.textContent = data.active || 0;
        todayActivationsEl.textContent = data.todayActivations || 0;
        // 管理员显示代理商分布
        if (data.agentStats && Array.isArray(data.agentStats) && data.agentStats.length > 0) {
            let html = '<h4 style="margin:8px 0 4px 0;">各代理商授权分布</h4>';
            html += '<table style="width:100%;border-collapse:collapse;text-align:center;">';
            html += '<tr><th>代理商</th><th>激活码数</th><th>有效</th><th>今日激活</th></tr>';
            data.agentStats.forEach(a => {
                html += `<tr><td>${a.name} (${a.username})</td><td>${a.licenseCount}</td><td>${a.activeCount}</td><td>${a.todayActivations}</td></tr>`;
            });
            html += '</table>';
            agentStatsContainer.innerHTML = html;
        } else {
            agentStatsContainer.innerHTML = '';
        }
    }

    async function saveLicense(event) {
        event.preventDefault();
        console.log('保存授权码...');
        
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
        
        // 检查日期是否有效
        if (!startDateInput.value) {
            alert('请选择开始日期');
            return;
        }
        
        if (!expiryDateInput.value) {
            alert('请选择到期日期');
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
            const response = await apiFetch(`${apiBaseUrl}/licenses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(licenseData)
            });

            console.log('保存授权码响应状态:', response.status);
            
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
            const response = await apiFetch(`${apiBaseUrl}/licenses`, {
                method: 'DELETE',
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ licenseKey: cleanLicenseKey })
            });
            
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            alert('删除成功！');
            fetchLicenses();

        } catch (error) {
            console.error('Error deleting license:', error);
            alert('删除失败，请查看控制台获取详情。');
        }
    }

    function generateRandomKey() {
        console.log('生成随机授权码');
        const prefix = "HOTEL";
        const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase();
        licenseKeyInput.value = `${prefix}-${randomPart}`;
    }

    function setDefaultDates() {
        console.log('设置默认日期');
        const today = new Date();
        const oneYearLater = new Date(today);
        oneYearLater.setFullYear(today.getFullYear() + 1);
        
        // 格式化日期为YYYY-MM-DD格式
        const formatDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };
        
        startDateInput.value = formatDate(today);
        expiryDateInput.value = formatDate(oneYearLater);
        
        // 确保日期选择器可用
        startDateInput.type = 'date';
        expiryDateInput.type = 'date';
    }

    async function handleLogin() {
        if (!loginUsername || !loginPassword) {
            console.error('登录表单元素未找到');
            return;
        }

        const username = loginUsername.value.trim();
        const password = loginPassword.value.trim();

        // 输入验证
        if (!username || !password) {
            loginMessage.textContent = '请输入用户名和密码';
            loginMessage.style.display = 'block';
            return;
        }

        // 禁用登录按钮，显示加载状态
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 登录中...';
        loginMessage.style.display = 'none';

        try {
            const response = await fetch(`${apiBaseUrl}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username,
                    password
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || '登录失败，请检查用户名和密码');
            }

            if (!data.token) {
                throw new Error('服务器响应错误：未返回token');
            }

            // 保存token和用户信息
            localStorage.setItem('token', data.token);
            currentUser = data.user;

            // 更新界面
            loginContainer.style.display = 'none';
            showMainContent();
            updateUserInfo();

            // 初始化数据
            await Promise.all([
                fetchDashboard(),
                fetchLicenses(),
                data.user.role === 'admin' ? fetchAccounts() : null
            ].filter(Boolean));

            // 根据用户角色更新界面
            updateAccountCardVisibility();
            showLogsCard(data.user.role === 'admin');
            renderPartnerStatsCard(data.user.role === 'admin');

        } catch (error) {
            console.error('登录错误:', error);
            loginMessage.textContent = error.message || '登录失败，请稍后重试';
            loginMessage.style.display = 'block';
        } finally {
            // 恢复登录按钮状态
            loginBtn.disabled = false;
            loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> 登录';
            // 清空密码输入
            loginPassword.value = '';
        }
    }
    
    // 登录成功后，拉取dashboard数据
    async function loginAndInit(token, user) {
        console.log('登录成功，初始化界面...');
        try {
            // 设置身份验证状态
            jwtToken = token;
            localStorage.setItem('token', token);
            currentUser = user;
            isAuthenticated = true;
            
            // 显示用户信息
            const userInfo = document.getElementById('userInfo');
            const welcomeText = document.getElementById('welcomeText');
            
            if (userInfo) userInfo.style.display = 'flex';
            if (welcomeText) {
                const roleName = user.role === 'admin' ? '超级管理员' : '合作伙伴';
                welcomeText.textContent = `欢迎回来，${user.name || user.username}（${roleName}）`;
            }
            
            // 添加登出按钮事件
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) {
                logoutBtn.onclick = () => {
                    localStorage.removeItem('token');
                    location.reload();
                };
            }
            
            // 管理员显示账号管理卡片
            console.log('当前用户角色:', user.role);
            updateAccountCardVisibility();
            
            // 获取数据
            await Promise.all([
                fetchLicenses(),
                fetchDashboard()
            ]);
            
            // 显示主要内容
            showMainContent();
            
            // 管理员显示操作日志和合作伙伴数据看板
            if (user.role === 'admin') {
                console.log('显示管理员特有功能');
                showLogsCard(true);
                // 确保合作伙伴统计看板正确初始化
                renderPartnerStatsCard(true);
                try {
                    const periodSelector = document.getElementById('statsPeriod');
                    if (periodSelector) {
                        console.log('获取合作伙伴统计数据，周期:', periodSelector.value);
                        await fetchPartnerStats(periodSelector.value);
                    } else {
                        console.log('未找到统计周期选择器，使用默认周期');
                        await fetchPartnerStats('month');
                    }
                } catch (statsError) {
                    console.error('获取合作伙伴统计数据失败:', statsError);
                }
            } else {
                // 非管理员不显示操作日志和合作伙伴统计
                showLogsCard(false);
                renderPartnerStatsCard(false);
            }
            
            // 非管理员显示重置密码按钮
            renderSelfResetPwdBtn();
            
            console.log('界面初始化完成');
        } catch (error) {
            console.error('初始化界面失败:', error);
            alert('初始化界面失败: ' + error.message);
        }
    }
    
    // 初始化表单和按钮
    function initFormAndButtons() {
        console.log('初始化表单和按钮');
        // 移除可能存在的旧事件监听器
        if (licenseForm) {
            licenseForm.removeEventListener('submit', saveLicense);
    licenseForm.addEventListener('submit', saveLicense);
            console.log('表单提交事件已绑定');
        }
        
        if (generateKeyBtn) {
            generateKeyBtn.removeEventListener('click', generateRandomKey);
    generateKeyBtn.addEventListener('click', generateRandomKey);
            console.log('随机生成按钮事件已绑定');
        }
        
        // 绑定表格操作事件
        if (licensesTableBody) {
            // 使用事件委托处理按钮点击
            licensesTableBody.onclick = async function(event) {
                // 复制功能
                if (event.target.classList.contains('copy-btn')) {
                    const text = event.target.getAttribute('data-copy');
                    try {
                        await navigator.clipboard.writeText(text);
                        event.target.textContent = '已复制';
                        setTimeout(() => { event.target.textContent = '复制'; }, 1200);
                    } catch (err) {
                        console.error('复制失败:', err);
                        alert('复制失败: ' + err.message);
                    }
                    return;
                }
                
                // 删除功能
                if (event.target.classList.contains('delete-btn')) {
                    if (!isAuthenticated) {
                        alert('请先登录');
                        showLoginForm();
                        return;
                    }
                    
                    const licenseKey = event.target.dataset.key;
                    if (!confirm(`确定要删除授权码 "${licenseKey}" 吗？此操作不可撤销。`)) return;
                    
                    const cleanLicenseKey = licenseKey.replace(/\*/g, '');
                    
                    try {
                        const response = await apiFetch(`${apiBaseUrl}/licenses`, {
                            method: 'DELETE',
                            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                            body: JSON.stringify({ licenseKey: cleanLicenseKey })
                        });
                        
                        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                        
                        alert('删除成功！');
                        fetchLicenses();
                    } catch (error) {
                        console.error('Error deleting license:', error);
                        alert('删除失败，请查看控制台获取详情。');
                    }
                }
            };
            console.log('表格操作事件已绑定');
        }
        
        // 确保日期选择器可用
        setDefaultDates();
    }
    
    // 初始化
    initFormAndButtons();
    setupLoginForm();
    
    // 检查是否有token，有则尝试自动登录
    if (jwtToken) {
        console.log('检测到token，尝试自动登录');
        // 尝试获取用户信息
        fetch(`${apiBaseUrl}/accounts/me`, {
            headers: { 'Authorization': `Bearer ${jwtToken}` }
        })
        .then(resp => {
            console.log('获取用户信息响应:', resp.status);
            if (!resp.ok) {
                throw new Error('Token无效');
            }
            return resp.json();
        })
        .then(data => {
            console.log('获取到用户信息:', data);
            if (data.user) {
                loginAndInit(jwtToken, data.user);
            } else {
                throw new Error('获取用户信息失败');
            }
        })
        .catch(err => {
            console.error('自动登录失败:', err);
            localStorage.removeItem('token');
            showLoginForm();
        });
    } else {
        console.log('没有token，显示登录表单');
        // 没有token，显示登录表单
        showLoginForm();
    }
    
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
        let start = Math.max(1, currentPage - 2);
        let end = Math.min(totalPages, start + 4);
        if (end - start < 4) start = Math.max(1, end - 4);
        // 上一页按钮
        const prevBtn = document.createElement('button');
        prevBtn.textContent = '«';
        prevBtn.disabled = currentPage === 1;
        prevBtn.className = 'page-btn';
        prevBtn.onclick = () => { if (currentPage > 1) { currentPage--; renderLicensesWithSearchAndPage(); } };
        paginationDiv.appendChild(prevBtn);
        // 数字页码
        for (let i = start; i <= end; i++) {
            const btn = document.createElement('button');
            btn.textContent = i;
            btn.className = 'page-btn' + (i === currentPage ? ' active' : '');
            btn.onclick = () => { currentPage = i; renderLicensesWithSearchAndPage(); };
            paginationDiv.appendChild(btn);
        }
        // 下一页按钮
        const nextBtn = document.createElement('button');
        nextBtn.textContent = '»';
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.className = 'page-btn';
        nextBtn.onclick = () => { if (currentPage < totalPages) { currentPage++; renderLicensesWithSearchAndPage(); } };
        paginationDiv.appendChild(nextBtn);
    }

    // 新增：初始渲染
    if (searchInput && paginationDiv) {
        renderLicensesWithSearchAndPage();
    }

    // 账号管理相关
    const accountCard = document.getElementById('accountCard');
    const addAccountForm = document.getElementById('addAccountForm');
    const newAccountUsername = document.getElementById('newAccountUsername');
    const newAccountName = document.getElementById('newAccountName');
    const newAccountPassword = document.getElementById('newAccountPassword');
    const accountsTable = document.getElementById('accountsTable').querySelector('tbody');

    // 重置密码弹窗
    function showResetPwdDialog(username, callback) {
        const dialog = document.createElement('div');
        dialog.style.position = 'fixed';
        dialog.style.left = '0';
        dialog.style.top = '0';
        dialog.style.width = '100vw';
        dialog.style.height = '100vh';
        dialog.style.background = 'rgba(0,0,0,0.3)';
        dialog.style.display = 'flex';
        dialog.style.alignItems = 'center';
        dialog.style.justifyContent = 'center';
        dialog.innerHTML = `<div style="background:#fff;padding:24px 32px;border-radius:8px;min-width:260px;box-shadow:0 2px 12px #0002;">
            <h3 style="margin-bottom:12px;">重置密码 - ${username}</h3>
            <input type="password" id="resetPwdInput" placeholder="新密码" style="width:100%;padding:8px;margin-bottom:12px;">
            <div style="text-align:right;">
                <button id="resetPwdCancel">取消</button>
                <button id="resetPwdOk" style="margin-left:8px;">确定</button>
            </div>
            <p id="resetPwdMsg" style="color:#d33;margin:8px 0 0 0;"></p>
        </div>`;
        document.body.appendChild(dialog);
        dialog.querySelector('#resetPwdCancel').onclick = () => document.body.removeChild(dialog);
        dialog.querySelector('#resetPwdOk').onclick = async () => {
            const pwd = dialog.querySelector('#resetPwdInput').value.trim();
            if (!pwd) {
                dialog.querySelector('#resetPwdMsg').textContent = '请输入新密码';
                return;
            }
            dialog.querySelector('#resetPwdOk').disabled = true;
            try {
                await callback(pwd);
                alert('密码重置成功！');
                document.body.removeChild(dialog);
            } catch (e) {
                dialog.querySelector('#resetPwdMsg').textContent = e.message || '重置失败';
                dialog.querySelector('#resetPwdOk').disabled = false;
            }
        };
    }

    // 仅管理员可见账号管理卡片
    function updateAccountCardVisibility() {
        if (currentUser && currentUser.role === 'admin') {
            accountCard.style.display = '';
            // 确保表单是空的
            if (addAccountForm) {
                addAccountForm.reset();
                // 防止浏览器自动填充
                setTimeout(() => {
                    if (newAccountUsername) newAccountUsername.value = '';
                    if (newAccountName) newAccountName.value = '';
                    if (newAccountPassword) newAccountPassword.value = '';
                }, 100);
            }
            // 立即获取账号列表数据
            console.log('管理员登录，立即获取账号列表');
            fetchAccounts();
        } else {
            accountCard.style.display = 'none';
        }
    }
    // 渲染账号表
    async function fetchAccounts() {
        try {
            console.log('开始获取账号列表，API URL:', apiBaseUrl + '/accounts');
            const resp = await apiFetch(apiBaseUrl + '/accounts', { 
                headers: getAuthHeaders(),
                method: 'GET'
            });
            
            if (!resp.ok) {
                const errorData = await resp.json().catch(() => ({ error: '获取账号列表失败' }));
                console.error('获取账号列表失败:', resp.status, errorData);
                const message = `获取账号列表失败: ${resp.status} ${errorData.error || resp.statusText}`;
                alert(message);
                
                // 在表中显示错误信息
                const tableBody = accountsTable;
                if (tableBody) {
                    tableBody.innerHTML = '';
                    const tr = document.createElement('tr');
                    const td = document.createElement('td');
                    td.colSpan = 5;
                    td.textContent = message;
                    td.style.textAlign = 'center';
                    td.style.color = 'red';
                    tr.appendChild(td);
                    tableBody.appendChild(tr);
                }
                return;
            }

            console.log('账号API响应成功，状态码:', resp.status);
            const data = await resp.json();
            console.log('获取到的账号数据:', data);
            
            // 直接使用accountsTable，它已经是tbody元素
            if (!accountsTable) {
                console.error("未找到accountsTable元素");
                return;
            }
            
            // 清空表格内容
            accountsTable.innerHTML = '';

            if (!data.accounts || data.accounts.length === 0) {
                console.log('账号列表为空');
                const tr = document.createElement('tr');
                const td = document.createElement('td');
                td.colSpan = 5;
                td.textContent = '没有找到账号信息。';
                td.style.textAlign = 'center';
                tr.appendChild(td);
                accountsTable.appendChild(tr);
            } else {
                console.log(`找到 ${data.accounts.length} 个账号，开始渲染表格`);
                data.accounts.forEach(acc => {
                    const tr = document.createElement('tr');
                    let ops = '';
                    if (acc.username !== 'admin') {
                        ops += `<button class='del-account-btn' data-u='${acc.username}'>删除</button>`;
                        ops += `<button class='reset-pwd-btn' data-u='${acc.username}'>重置密码</button>`;
                    }
                    tr.innerHTML = `<td>${acc.username}</td><td>${acc.name}</td><td>${acc.role}</td><td>${acc.createdAt ? acc.createdAt.split('T')[0] : '—'}</td><td>${ops}</td>`;
                    accountsTable.appendChild(tr);
                });
            }
        } catch (error) {
            console.error("fetchAccounts 函数出错:", error);
            alert("获取账号列表时发生客户端错误: " + error.message);
            
            // 在表中显示错误信息
            if (accountsTable) {
                accountsTable.innerHTML = '';
                const tr = document.createElement('tr');
                const td = document.createElement('td');
                td.colSpan = 5;
                td.textContent = '获取账号列表时发生错误: ' + error.message;
                td.style.textAlign = 'center';
                td.style.color = 'red';
                tr.appendChild(td);
                accountsTable.appendChild(tr);
            }
        }
    }
    
    // 添加账号
    addAccountForm.onsubmit = async function(e) {
        e.preventDefault();
        console.log('提交添加账号表单');
        
        // 获取表单数据
        const username = newAccountUsername.value.trim();
        const name = newAccountName.value.trim();
        const password = newAccountPassword.value;
        
        // 表单验证
        if (!username) {
            alert('请输入用户名');
            newAccountUsername.focus();
            return;
        }
        
        if (!name) {
            alert('请输入合作伙伴名称');
            newAccountName.focus();
            return;
        }
        
        if (!password) {
            alert('请输入密码');
            newAccountPassword.focus();
            return;
        }
        
        try {
            // 显示加载状态
            const submitBtn = addAccountForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = '添加中...';
            
            console.log('发送添加账号请求:', { username, name });
            const resp = await apiFetch(apiBaseUrl + '/accounts', {
                method: 'POST', 
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, name, password })
            });
            
            const data = await resp.json();
            
            if (!resp.ok) {
                console.error('添加账号失败:', data);
                alert(data.error || '添加失败');
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
                return;
            }
            
            console.log('添加账号成功:', data);
            alert('添加成功');
            addAccountForm.reset(); // 使用标准的reset()方法
            fetchAccounts();
        } catch (error) {
            console.error('添加账号出错:', error);
            alert('添加账号时发生错误，请稍后重试');
        } finally {
            // 恢复按钮状态
            const submitBtn = addAccountForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = '添加合作伙伴';
            }
        }
    };
    // 账号表按钮事件
    accountsTable.onclick = async function(e) {
        if (e.target.classList.contains('del-account-btn')) {
            const username = e.target.dataset.u;
            if (!confirm('确定要删除账号 ' + username + ' 吗？')) return;
            
            try {
                console.log('发送删除账号请求:', { username });
                const deleteBtn = e.target;
                deleteBtn.disabled = true;
                deleteBtn.textContent = '删除中...';
                
                const resp = await apiFetch(apiBaseUrl + '/accounts', {
                    method: 'DELETE', 
                    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username })
                });
                
                const data = await resp.json();
                
                if (!resp.ok) {
                    console.error('删除账号失败:', data);
                    alert(data.error || '删除失败');
                    deleteBtn.disabled = false;
                    deleteBtn.textContent = '删除';
                    return;
                }
                
                console.log('删除账号成功:', data);
                alert('删除成功');
                fetchAccounts();
            } catch (error) {
                console.error('删除账号出错:', error);
                alert('删除账号时发生错误，请稍后重试');
                // 恢复按钮状态
                const deleteBtn = e.target;
                if (deleteBtn) {
                    deleteBtn.disabled = false;
                    deleteBtn.textContent = '删除';
                }
            }
        } else if (e.target.classList.contains('reset-pwd-btn')) {
            const username = e.target.dataset.u;
            showResetPwdDialog(username, async (newPwd) => {
                try {
                    console.log('发送重置密码请求:', { username });
                    const resp = await apiFetch(apiBaseUrl + '/reset-password', {
                        method: 'POST', 
                        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, newPassword: newPwd })
                    });
                    
                    const data = await resp.json();
                    
                    if (!resp.ok) {
                        console.error('重置密码失败:', data);
                        throw new Error(data.error || '重置失败');
                    }
                    
                    console.log('重置密码成功:', data);
                } catch (error) {
                    console.error('重置密码出错:', error);
                    throw error;
                }
            });
        }
    };

    // 非admin右上角重置密码按钮
    function renderSelfResetPwdBtn() {
        if (!currentUser || currentUser.role === 'admin') return;
        let btn = document.getElementById('selfResetPwdBtn');
        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'selfResetPwdBtn';
            btn.textContent = '重置密码';
            btn.style.position = 'absolute';
            btn.style.top = '18px';
            btn.style.right = '32px';
            btn.style.zIndex = '10';
            document.body.appendChild(btn);
        }
        btn.onclick = () => {
            showResetPwdDialog(currentUser.username, async (newPwd) => {
                try {
                    console.log('发送重置自己密码请求');
                    const resp = await apiFetch(apiBaseUrl + '/reset-password', {
                        method: 'POST', 
                        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username: currentUser.username, newPassword: newPwd })
                    });
                    
                    const data = await resp.json();
                    
                    if (!resp.ok) {
                        console.error('重置密码失败:', data);
                        throw new Error(data.error || '重置失败');
                    }
                    
                    console.log('重置密码成功:', data);
                } catch (error) {
                    console.error('重置密码出错:', error);
                    throw error;
                }
            });
        };
    }

    // 日志相关
    const logsCard = document.getElementById('logsCard');
    const logsTable = document.getElementById('logsTable').querySelector('tbody');
    const logsPagination = document.getElementById('logsPagination');
    let logsPage = 1;
    const LOGS_PAGE_SIZE = 20;

    async function fetchLogs(page = 1) {
        const resp = await apiFetch(`/api/admin/logs?page=${page}&pageSize=${LOGS_PAGE_SIZE}`, { headers: getAuthHeaders() });
        const data = await resp.json();
        renderLogsTable(data.logs || []);
        // 简单分页（不查总数，前后翻页）
        logsPagination.innerHTML = '';
        const prevBtn = document.createElement('button');
        prevBtn.textContent = '«';
        prevBtn.disabled = page === 1;
        prevBtn.onclick = () => { if (logsPage > 1) { logsPage--; fetchLogs(logsPage); } };
        logsPagination.appendChild(prevBtn);
        const nextBtn = document.createElement('button');
        nextBtn.textContent = '»';
        nextBtn.onclick = () => { logsPage++; fetchLogs(logsPage); };
        logsPagination.appendChild(nextBtn);
    }
    function renderLogsTable(logs) {
        logsTable.innerHTML = '';
        if (!logs.length) {
            logsTable.innerHTML = '<tr><td colspan="4" style="text-align:center;">暂无日志</td></tr>';
            return;
        }
        logs.forEach(log => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${log.time.replace('T',' ').slice(0,19)}</td><td>${log.username} (${log.role})</td><td>${log.type}</td><td>${log.detail}</td>`;
            logsTable.appendChild(tr);
        });
    }
    // 管理员登录后自动显示日志卡片，代理商可手动切换
    function showLogsCard(show) {
        logsCard.style.display = show ? '' : 'none';
        if (show) {
            logsPage = 1;
            fetchLogs(logsPage);
        }
    }

    // 新增：管理员的合作伙伴统计看板
    function renderPartnerStatsCard(isAdmin) {
        // 检查是否已存在看板
        let partnerStatsCard = document.getElementById('partnerStatsCard');
        
        // 如果不是管理员或看板已存在且需要移除
        if (!isAdmin) {
            if (partnerStatsCard) {
                partnerStatsCard.remove();
            }
            return;
        }
        
        // 为管理员创建或更新看板
        if (!partnerStatsCard) {
            partnerStatsCard = document.createElement('div');
            partnerStatsCard.id = 'partnerStatsCard';
            partnerStatsCard.className = 'card';
            
            // 将看板插入到dashboard之后
            const dashboard = document.getElementById('dashboard');
            if (dashboard && dashboard.nextSibling) {
                dashboard.parentNode.insertBefore(partnerStatsCard, dashboard.nextSibling);
            } else if (dashboard) {
                dashboard.parentNode.appendChild(partnerStatsCard);
            }
        }
        
        // 设置看板内容
        partnerStatsCard.innerHTML = `
            <h2><i class="fas fa-chart-pie"></i> 合作伙伴数据看板</h2>
            <div class="partner-stats-controls">
                <div class="stats-period-selector">
                    <label><i class="fas fa-calendar-alt"></i> 统计周期：</label>
                    <select id="statsPeriod">
                        <option value="day">今日</option>
                        <option value="week">本周</option>
                        <option value="month" selected>本月</option>
                        <option value="year">本年</option>
                        <option value="all">全部</option>
                    </select>
                </div>
            </div>
            <div class="table-responsive">
                <table id="partnerStatsTable">
                    <thead>
                        <tr>
                            <th><i class="fas fa-user-tie"></i> 合作伙伴</th>
                            <th><i class="fas fa-key"></i> 总授权数</th>
                            <th><i class="fas fa-check-circle"></i> 有效授权</th>
                            <th><i class="fas fa-bolt"></i> 本期激活</th>
                            <th><i class="fas fa-chart-line"></i> 趋势</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td colspan="5" style="text-align:center;">加载中...</td></tr>
                    </tbody>
                </table>
            </div>
        `;
        
        // 添加周期选择事件
        const periodSelector = document.getElementById('statsPeriod');
        if (periodSelector) {
            periodSelector.addEventListener('change', () => {
                fetchPartnerStats(periodSelector.value);
            });
            
            // 初始加载数据
            fetchPartnerStats(periodSelector.value);
        }
    }
    
    // 获取合作伙伴统计数据
    async function fetchPartnerStats(period = 'month') {
        try {
            console.log(`获取合作伙伴统计数据，周期: ${period}，URL: ${apiBaseUrl}/dashboard?period=${period}`);
            const resp = await apiFetch(`${apiBaseUrl}/dashboard?period=${period}`);
            
            if (!resp.ok) {
                console.error('获取合作伙伴统计数据失败:', resp.status, resp.statusText);
                throw new Error(`获取数据失败: ${resp.status} ${resp.statusText}`);
            }
            
            const data = await resp.json();
            console.log('获取到的合作伙伴统计数据:', data);
            
            // 更新表格
            const tbody = document.querySelector('#partnerStatsTable tbody');
            if (!tbody) {
                console.error('找不到合作伙伴统计表格元素');
                return;
            }
            
            if (!data.agentStats || data.agentStats.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">暂无数据</td></tr>';
                return;
            }
            
            tbody.innerHTML = '';
            data.agentStats.forEach(agent => {
                const row = document.createElement('tr');
                
                // 简单的趋势图标
                const trendIcon = agent.trend > 0 ? '<i class="fas fa-arrow-up" style="color:#27ae60"></i>' : 
                                 agent.trend < 0 ? '<i class="fas fa-arrow-down" style="color:#e74c3c"></i>' : 
                                 '<i class="fas fa-equals" style="color:#7f8c8d"></i>';
                
                row.innerHTML = `
                    <td>${agent.name || 'unknown'} (${agent.username || 'unknown'})</td>
                    <td>${agent.licenseCount || 0}</td>
                    <td>${agent.activeCount || 0}</td>
                    <td>${agent.todayActivations || 0}</td>
                    <td>${trendIcon}</td>
                `;
                tbody.appendChild(row);
            });
            
        } catch (error) {
            console.error('获取合作伙伴统计数据失败:', error);
            const tbody = document.querySelector('#partnerStatsTable tbody');
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">数据加载失败: ${error.message}</td></tr>`;
            }
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
            const response = await apiFetch(`${apiBaseUrl}/licenses`, {
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
    
    // 旧版登录函数，保留兼容性
    async function login(password) {
        try {
            const response = await apiFetch(`${apiBaseUrl}/licenses`, {
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

    // 添加登录按钮事件监听
    function setupLoginForm() {
        if (loginContainer && loginBtn && loginPassword) {
            // 新版登录表单
            loginBtn.addEventListener('click', handleLogin);
            loginPassword.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleLogin();
                }
            });
            return;
        }
        
        // 等待旧版登录表单创建完成
        setTimeout(() => {
            // 旧版登录兼容
            const oldLoginBtn = document.getElementById('loginBtn');
            const passwordInput = document.getElementById('adminPassword');
            
            if (oldLoginBtn && passwordInput) {
                oldLoginBtn.addEventListener('click', handleLogin);
                passwordInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        handleLogin();
                    }
                });
            }
        }, 100);
    }
}); 