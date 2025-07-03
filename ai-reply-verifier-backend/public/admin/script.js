document.addEventListener('DOMContentLoaded', () => {
    // 使用相对路径，确保API路径正确
    const apiBaseUrl = '/api/admin';
    let password = null;
    let allLicenses = {}; // Cache for licenses

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
                alert('获取授权码列表失败，请检查密码或网络连接。');
                promptForPassword(); // 重新提示输入密码
                return;
            }
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            allLicenses = await response.json();
            console.log('获取到的授权码数据:', allLicenses);
            renderLicenses(allLicenses);
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

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${licenseKey}</td>
                <td>${license.hotelName}</td>
                <td>${license.startDate || 'N/A'}</td>
                <td>${license.expiryDate}</td>
                <td class="status-${isActive ? 'active' : 'expired'}">${isActive ? '有效' : '已过期'}</td>
                <td>${activations.length}</td>
                <td>${lastIP}</td>
                <td><button class="delete-btn" data-key="${licenseKey}">删除</button></td>
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

        const licenseKey = event.target.dataset.key;
        if (!confirm(`确定要删除授权码 "${licenseKey}" 吗？此操作不可撤销。`)) return;
        
        const cleanLicenseKey = licenseKey.replace(/\*/g, '');

        try {
            const response = await fetch(`${apiBaseUrl}/licenses`, {
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

    function promptForPassword() {
        password = prompt('请输入管理员密码 (默认: admin):', '');
        if (password) {
            fetchLicenses();
        } else {
            alert('未输入密码，无法加载数据。');
        }
    }
    
    // 添加JD-FIRST-KEY授权码
    async function addDefaultLicense() {
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
            
            if (!response.ok) {
                console.error('添加默认授权码失败:', response.status);
                return;
            }
            
            console.log('默认授权码添加成功');
            fetchLicenses();
        } catch (error) {
            console.error('添加默认授权码出错:', error);
        }
    }
    
    // Initial setup
    licenseForm.addEventListener('submit', saveLicense);
    licensesTableBody.addEventListener('click', deleteLicense);
    generateKeyBtn.addEventListener('click', generateRandomKey);
    
    setDefaultDates();
    promptForPassword();
    
    // 添加一个按钮，用于添加默认授权码
    const addDefaultBtn = document.createElement('button');
    addDefaultBtn.textContent = '添加默认授权码 (JD-FIRST-KEY)';
    addDefaultBtn.style.marginTop = '20px';
    addDefaultBtn.style.backgroundColor = '#9b59b6';
    addDefaultBtn.addEventListener('click', addDefaultLicense);
    document.querySelector('.container').appendChild(addDefaultBtn);
}); 