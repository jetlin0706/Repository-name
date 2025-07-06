/**
 * 携程/美团 AI回复助手弹出面板脚本
 * @version 7.0.0 (引入授权码机制)
 */
document.addEventListener('DOMContentLoaded', function () {
    // --- DOM 元素获取 ---
    const licenseKeyInput = document.getElementById('licenseKey');
    const activateButton = document.getElementById('activate');
    const statusMessage = document.getElementById('statusMessage');
    const saveButton = document.getElementById('saveButton');
    const hotelNameInput = document.getElementById('hotelName');
    const hotelPhoneInput = document.getElementById('hotelPhone');
    const mustIncludeInput = document.getElementById('mustInclude');
    const forbiddenWordsInput = document.getElementById('forbiddenWords');
    const maxLengthInput = document.getElementById('maxLength');
    const enableToggle = document.getElementById('enable-ai-toggle');
    const settingsPanel = document.getElementById('settings-panel');

    // --- 安全检查：确保所有关键元素都存在 ---
    if (!licenseKeyInput || !activateButton || !statusMessage || !saveButton || !settingsPanel) {
        console.error('AI助手-弹窗: 一个或多个关键UI元素未在HTML中找到，脚本无法继续执行。');
        if (statusMessage) {
            statusMessage.textContent = 'UI组件加载错误，请联系技术支持。';
            statusMessage.className = 'status-message error';
        }
        return; // 提前退出，防止后续代码报错
    }
    
    // --- 函数定义 ---

    /**
     * 显示状态信息
     * @param {string} message - 要显示的消息
     * @param {'success'|'error'|'info'} type - 消息类型
     */
    function showStatus(message, type = 'info') {
        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type}`;
        if (type !== 'info') {
            setTimeout(() => {
                statusMessage.textContent = '';
                statusMessage.className = 'status-message';
            }, 4000);
        }
    }

    /**
     * 更新UI的锁定状态
     * @param {boolean} isActivated - 是否已激活
     */
    function updateUiLockState(isActivated) {
        if (isActivated) {
            settingsPanel.classList.remove('locked');
            licenseKeyInput.disabled = true;
            activateButton.disabled = true;
            activateButton.textContent = '已激活';
        } else {
            settingsPanel.classList.add('locked');
            licenseKeyInput.disabled = false;
            activateButton.disabled = false;
            activateButton.textContent = '激活';
        }
    }

    /**
     * 处理激活逻辑
     */
    function handleActivation() {
        const licenseKey = licenseKeyInput.value.trim();
        if (!licenseKey) {
            showStatus('请输入授权码', 'error');
            return;
        }

        console.log('开始激活流程，授权码:', licenseKey);
        activateButton.disabled = true;
        activateButton.textContent = '正在激活...';
        showStatus('正在连接服务器验证授权码...', 'info');

        chrome.runtime.sendMessage({ action: 'verify-license', key: licenseKey }, (response) => {
            console.log('收到验证响应:', response);
            
            if (chrome.runtime.lastError) {
                console.error('验证过程出错:', chrome.runtime.lastError);
                showStatus(`验证出错: ${chrome.runtime.lastError.message}`, 'error');
                activateButton.disabled = false;
                activateButton.textContent = '激活';
                return;
            }
            
            if (response && response.valid) {
                console.log('验证成功，正在保存状态');
                chrome.storage.local.set({ 
                    isActivated: true, 
                    licenseKey: licenseKey,
                    hotelName: response.hotelName || ''
                }, () => {
                    if (chrome.runtime.lastError) {
                        console.error('保存状态出错:', chrome.runtime.lastError);
                        showStatus(`保存状态出错: ${chrome.runtime.lastError.message}`, 'error');
                        activateButton.disabled = false;
                        activateButton.textContent = '激活';
                        return;
                    }
                    
                    console.log('激活成功完成');
                    showStatus('激活成功！', 'success');
                    updateUiLockState(true);

                    // 自动填充酒店名称
                    if(hotelNameInput && response.hotelName) {
                        hotelNameInput.value = response.hotelName;
                    }
                });
            } else {
                console.error('验证失败:', response);
                showStatus(response?.error || response?.message || '验证失败，请检查网络或联系管理员', 'error');
                activateButton.disabled = false;
                activateButton.textContent = '激活';
                updateUiLockState(false);
            }
        });
    }
    
    /**
     * 保存设置
     */
    function saveSettings() {
        const settings = {
            enabled: enableToggle ? enableToggle.checked : true,
            hotelName: hotelNameInput ? hotelNameInput.value : '',
            hotelPhone: hotelPhoneInput ? hotelPhoneInput.value : '',
            mustInclude: mustIncludeInput ? mustIncludeInput.value : '',
            forbiddenWords: forbiddenWordsInput ? forbiddenWordsInput.value : ''
        };
        chrome.storage.local.set({ settings: settings }, () => {
            showStatus('设置已保存！', 'success');
        });
    }

    // --- 初始化逻辑 ---

    // 1. 添加事件监听器
    activateButton.addEventListener('click', handleActivation);
    saveButton.addEventListener('click', saveSettings);

    // 2. 加载初始状态和设置
    chrome.storage.local.get(['isActivated', 'licenseKey', 'settings'], function (data) {
        // 更新激活状态和UI
        const isActivated = data.isActivated || false;
        updateUiLockState(isActivated);
        if (isActivated && data.licenseKey) {
            licenseKeyInput.value = data.licenseKey;
        }

        // 加载用户设置
        if (data.settings) {
            if (enableToggle) enableToggle.checked = data.settings.enabled !== false;
            if (hotelNameInput) hotelNameInput.value = data.settings.hotelName || '';
            if (hotelPhoneInput) hotelPhoneInput.value = data.settings.hotelPhone || '';
            if (mustIncludeInput) mustIncludeInput.value = data.settings.mustInclude || '';
            if (forbiddenWordsInput) forbiddenWordsInput.value = data.settings.forbiddenWords || '';
            if (maxLengthInput) maxLengthInput.value = data.settings.maxLength || '';
        }
    });
}); 