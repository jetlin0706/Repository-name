document.addEventListener('DOMContentLoaded', async () => {
  const enableSwitch = document.getElementById('enable-switch');
  const licenseKeyInput = document.getElementById('license-key');
  const hotelNameInput = document.getElementById('hotel-name');
  const hotelPhoneInput = document.getElementById('hotel-phone');
  const mustIncludeInput = document.getElementById('must-include');
  const saveButton = document.getElementById('save-button');
  const activateButton = document.getElementById('activate-button');
  const messageDiv = document.getElementById('message');

  // 显示消息
  function showMessage(text, type = 'error') {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    setTimeout(() => {
      messageDiv.style.display = 'none';
    }, 3000);
  }
  
  // 加载设置
  chrome.storage.sync.get(['enabled', 'licenseKey', 'hotelName', 'hotelPhone', 'mustInclude', 'isValid'], (result) => {
    enableSwitch.checked = !!result.enabled;
    licenseKeyInput.value = result.licenseKey || '';
    hotelNameInput.value = result.hotelName || '';
    hotelPhoneInput.value = result.hotelPhone || '';
    mustIncludeInput.value = result.mustInclude || '';

    if (result.isValid) {
      activateButton.textContent = '已激活';
      activateButton.disabled = true;
      activateButton.style.backgroundColor = '#28a745';
    } else {
       activateButton.textContent = '激活';
       activateButton.disabled = false;
    }
  });

  // 激活许可证
  async function verifyLicense(licenseKey) {
    try {
      const response = await fetch('http://43.142.109.130:3001/api/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ licenseKey })
      });

      // 即使是4xx/5xx错误，也尝试读取JSON，因为我们后端就是这么返回的
      const data = await response.json();
      return data;

    } catch (error) {
      console.error('验证请求失败:', error);
      return { valid: false, message: '无法连接到验证服务器，请检查网络' };
    }
  }

  // 激活按钮点击事件
  activateButton.addEventListener('click', async () => {
    const licenseKey = licenseKeyInput.value.trim();
    if (!licenseKey) {
      showMessage('请输入授权码');
      return;
    }
    
    activateButton.disabled = true;
    activateButton.textContent = '验证中...';

    const result = await verifyLicense(licenseKey);

    if (result.valid) {
      chrome.storage.sync.set({ isValid: true, licenseKey: licenseKey }, () => {
        showMessage('激活成功', 'success');
        activateButton.textContent = '已激活';
        activateButton.style.backgroundColor = '#28a745';
      });
    } else {
      chrome.storage.sync.set({ isValid: false }, () => {
        showMessage(result.message || '激活失败，请检查授权码');
        activateButton.disabled = false;
        activateButton.textContent = '激活';
      });
    }
  });

  // 保存设置
  saveButton.addEventListener('click', async () => {
    const settings = {
      enabled: enableSwitch.checked,
      hotelName: hotelNameInput.value.trim(),
      hotelPhone: hotelPhoneInput.value.trim(),
      mustInclude: mustIncludeInput.value.trim()
    };

    chrome.storage.sync.set(settings, () => {
      showMessage('设置已保存', 'success');
      // 通知 content_script 更新配置
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0] && tabs[0].id) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'SETTINGS_UPDATED', settings: settings });
        }
      });
    });
  });
}); 