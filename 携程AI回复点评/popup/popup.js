/**
 * 携程/美团 AI回复助手弹出面板脚本
 * @version 7.0.0 (引入授权码机制)
 */
document.addEventListener('DOMContentLoaded', async () => {
    // --- 常量定义 ---
    // 将占位符URL替换为实际部署的URL
    const VERIFIER_URL = 'https://ai-reply-proxy-new.jetlin0706.workers.dev/api/verify';
    
    // --- DOM元素获取 ---
    const featureEnabledSwitch = document.getElementById('featureEnabled');
    const licensePanel = document.getElementById('license-panel');
    const settingsPanel = document.getElementById('settings-panel');
    const saveButton = document.getElementById('saveButton');
    const statusDiv = document.getElementById('status');
    const licenseKeyInput = document.getElementById('licenseKey');
    const activateButton = document.getElementById('activateButton');
    const inputs = ['hotelName', 'hotelPhone', 'mustInclude'];
    
    function log(message) {
        console.log(`[AI助手-弹窗] ${message}`);
    }
    
    log("弹出面板已加载 (v7.0.0)");
    
    // --- 主逻辑 ---
    
    // 初始化加载
    await initializeApp();
    
    // --- 事件监听 ---
    
    // 功能总开关
    featureEnabledSwitch.addEventListener('change', handleFeatureToggle);
    
    // 保存设置按钮
    saveButton.addEventListener('click', saveSettings);
    
    // 激活授权码按钮
    activateButton.addEventListener('click', handleActivation);
    
    // 语气按钮选中逻辑
    const toneBtns = document.querySelectorAll('.tone-btn');
    toneBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            toneBtns.forEach(b => b.classList.remove('selected'));
            this.classList.add('selected');
            // 存储选中的语气到本地
            chrome.storage.local.set({ selectedTone: this.dataset.tone });
        });
    });
    // 初始化时恢复选中态
    chrome.storage.local.get(['selectedTone'], data => {
        if (data.selectedTone) {
            const btn = document.querySelector(`.tone-btn[data-tone="${data.selectedTone}"]`);
            if (btn) btn.classList.add('selected');
        }
    });
    
    // --- 函数定义 ---
    
    async function initializeApp() {
        try {
            const data = await chrome.storage.local.get(['enabled', 'isActivated', 'licenseKey', ...inputs]);
            log(`加载本地数据: ${JSON.stringify(data)}`);
            
            const isEnabled = data.enabled !== false; // 默认为true
            const isActivated = data.isActivated === true;
            
            // 更新UI状态
            featureEnabledSwitch.checked = isEnabled;
            licenseKeyInput.value = data.licenseKey || '';
            updateUiLockState(isActivated);
            
            // 加载用户设置
            inputs.forEach(id => {
                const element = document.getElementById(id);
                if (element && data[id]) {
                    element.value = data[id];
                }
            });
            
            toggleSettingsPanel(isEnabled);
            
        } catch (err) {
            log("初始化失败: " + err.message);
            showStatus('加载设置失败', 'error');
        }
    }
    
    function updateUiLockState(isActivated) {
        if (isActivated) {
            licensePanel.style.display = 'none'; // 激活后隐藏授权区域
            settingsPanel.classList.remove('disabled');
            saveButton.disabled = false;
            showStatus('授权有效，功能已激活', 'success');
        } else {
            licensePanel.style.display = 'block';
            settingsPanel.classList.add('disabled');
            saveButton.disabled = true;
        }
    }
    
    function toggleSettingsPanel(isEnabled) {
        // 这个函数现在只控制总开关的效果，不控制锁定
        if (isEnabled) {
            settingsPanel.style.opacity = '1';
            saveButton.style.opacity = '1';
        } else {
            settingsPanel.style.opacity = '0.5';
            saveButton.style.opacity = '0.5';
        }
    }
    
    async function handleFeatureToggle() {
        const isEnabled = featureEnabledSwitch.checked;
        log(`功能开关切换: ${isEnabled ? '启用' : '禁用'}`);
        
        toggleSettingsPanel(isEnabled);
        
        try {
            await chrome.storage.local.set({ enabled: isEnabled });
            
            // 通知所有相关标签页
            const tabs = await chrome.tabs.query({ url: ["*://*.ctrip.com/*", "*://*.meituan.com/*"] });
            for (const tab of tabs) {
                try {
                    await chrome.tabs.sendMessage(tab.id, { action: 'statusChanged', enabled: isEnabled });
                } catch (e) {
                    log(`无法向标签页 ${tab.id} 发送消息: ${e.message}`);
                }
            }
            showStatus(isEnabled ? 'AI功能已启用' : 'AI功能已禁用', 'info');
        } catch (err) {
            log("处理开关切换失败: " + err.message);
            showStatus('更新设置失败', 'error');
        }
    }
    
    async function handleActivation() {
        const key = licenseKeyInput.value.trim();
        if (!key) {
            showStatus('请输入授权码', 'error');
            return;
        }
        
        activateButton.disabled = true;
        activateButton.textContent = '验证中...';
        showStatus('正在连接服务器验证授权码...', 'info');
        
        try {
            const response = await fetch(VERIFIER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ licenseKey: key })
            });
            
            const result = await response.json();
            
            if (response.ok && result.valid) {
                await chrome.storage.local.set({ isActivated: true, licenseKey: key });
                updateUiLockState(true);
                log(`授权码 ${key} 验证成功`);
                showStatus('授权码验证成功', 'success');
            } else {
                await chrome.storage.local.set({ isActivated: false });
                showStatus(result.message || '授权码无效或已过期，请重试', 'error');
                log(`授权码 ${key} 验证失败: ${result.message || response.status}`);
            }
        } catch (error) {
            log(`验证请求失败: ${error.message}`);
            showStatus('验证失败，请检查网络连接或联系管理员', 'error');
        } finally {
            activateButton.disabled = false;
            activateButton.textContent = '激活';
        }
    }
    
    async function saveSettings() {
        try {
            const settings = {};
            inputs.forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    settings[id] = element.value.trim();
                }
            });
            
            log("保存设置: " + JSON.stringify(settings));
            await chrome.storage.local.set(settings);
            
            showStatus('设置已保存', 'success');
        } catch (err) {
            log("保存设置失败: " + err.message);
            showStatus('保存设置失败，请重试', 'error');
        }
    }
    
    function showStatus(message, type = 'info') {
        statusDiv.textContent = message;
        statusDiv.className = `status ${type}`;
        setTimeout(() => {
            statusDiv.textContent = '';
            statusDiv.className = 'status';
        }, 5000); // 延长显示时间以便用户看到
    }
}); 