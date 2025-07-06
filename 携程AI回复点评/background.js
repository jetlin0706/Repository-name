/**
 * @file 携程/美团 AI回复助手后台脚本
 * @version 6.0.5 (增强稳定性，修复连接错误)
 * 
 * 本脚本负责在后台管理扩展状态，并在页面加载时自动注入内容脚本。
 */

console.log("AI回复助手后台脚本 v6.0.5 已启动。");

// API配置
const API_HOST = 'https://api.b9349.dpdns.org/v1/chat/completions';
const API_KEY = 'sk-fQKLPbgViQUU8Kr77xqXm9gBvvfoi8xfmXY7axldYUETnz2U'; // 请替换为您的API Key
const API_MODEL = 'deepseek-ai/DeepSeek-R1';

const LOG_PREFIX = '[AI助手-后台]';
const MAX_LOG_ENTRIES = 100;

// 存储日志
const logs = [];
function addLog(message) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    console.log(`${LOG_PREFIX} ${logEntry}`);
    logs.push(logEntry);

    // 保持日志不超过100条
    if (logs.length > MAX_LOG_ENTRIES) {
        logs.shift();
    }
}

// 初始化存储 - 确保扩展始终处于启用状态
chrome.runtime.onInstalled.addListener(() => {
    addLog('扩展已安装或更新');
    
    chrome.storage.local.set({
        enabled: true,
        defaultTone: 'friendly',
        hotelName: '',
        hotelPhone: '',
        mustInclude: ''
    }, () => {
        addLog('默认配置已设置，扩展默认为启用状态');
    });
});

// 判断是否为目标网站
function isTargetWebsite(url) {
    if (!url) return false;
    
    return url.includes('ctrip.com') || 
           url.includes('meituan.com') || 
           url.includes('dianping.com') ||
           url.includes('ebooking') ||
           url.includes('e.meituan') ||
           url.includes('b.meituan') ||
           url.includes('waimai.meituan') ||
           url.includes('美团');
                }

// 监听标签页更新事件，自动注入脚本
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    try {
        if (changeInfo.status === 'loading') {
            addLog(`标签页 ${tabId} 开始加载，URL: ${tab.url || '未知'}`);
        }
        
        // 页面完成加载时尝试注入脚本
        if (changeInfo.status === 'complete') {
            addLog(`标签页 ${tabId} 加载完成，URL: ${tab.url || '未知'}`);
            
            // 目标网站才注入
            if (isTargetWebsite(tab.url)) {
                addLog(`检测到目标网站: ${tab.url}`);
                
                // 获取存储的启用状态
                chrome.storage.local.get(['enabled'], (result) => {
                    const isEnabled = result.enabled !== false; // 默认为true
                    
                    addLog(`当前扩展状态: ${isEnabled ? '启用' : '禁用'}`);
                    
                    if (isEnabled) {
                        // 注入脚本
                        injectContentScript(tabId)
                            .then(result => {
                                if (result && result.success) {
                                    addLog(`脚本成功注入到标签页 ${tabId}`);
                                } else {
                                    addLog(`脚本注入失败: ${result?.reason || '未知原因'}`);
                                }
                            })
                            .catch(error => {
                                addLog(`脚本注入出错: ${error.message}`);
                            });
                    } else {
                        addLog(`扩展当前已禁用，不注入脚本`);
                    }
                });
            }
        }
    } catch (error) {
        addLog(`标签页监听错误: ${error.message}`);
    }
});

// 注入内容脚本
function injectContentScript(tabId) {
    addLog(`尝试向标签页 ${tabId} 注入脚本`);
    
    return new Promise((resolve, reject) => {
        try {
            // 检查标签页是否存在
            chrome.tabs.get(tabId, (tab) => {
                if (chrome.runtime.lastError) {
                    const error = `标签页 ${tabId} 不存在: ${chrome.runtime.lastError.message}`;
                    addLog(error);
                    reject(new Error(error));
                    return;
                }
                
                // 执行脚本注入
                chrome.scripting.executeScript({
                    target: {tabId: tabId},
                    files: ['content_script.js']
                })
                .then(() => {
                    addLog(`脚本成功注入到标签页 ${tabId}`);
                    
                    // 注入CSS
                    chrome.scripting.insertCSS({
                        target: {tabId: tabId},
                        files: ['style.css']
                    })
                    .then(() => {
                        addLog(`CSS成功注入到标签页 ${tabId}`);
                        resolve({success: true});
                    })
                    .catch((error) => {
                        const errorMsg = `CSS注入失败: ${error.message}`;
                        addLog(errorMsg);
                        // CSS失败不算完全失败，仍然继续
                        resolve({success: true, warning: errorMsg});
                    });
                })
                .catch((error) => {
                    const errorMsg = `脚本注入失败: ${error.message}`;
                    addLog(errorMsg);
                    reject(new Error(errorMsg));
                });
            });
        } catch (e) {
            const errorMsg = `注入过程出错: ${e.message}`;
            addLog(errorMsg);
            reject(new Error(errorMsg));
        }
    });
}

// 授权验证API地址
const VERIFIER_URL = 'http://43.142.109.130:3002/api/verify';

// Function to get or create a machine ID
function getOrCreateMachineId(callback) {
    chrome.storage.local.get('machineId', function(data) {
        if (data.machineId) {
            callback(data.machineId);
        } else {
            // Generate a new ID if one doesn't exist
            const newId = 'machine-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            chrome.storage.local.set({ 'machineId': newId }, function() {
                callback(newId);
            });
        }
    });
}

// 处理所有消息请求
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('收到消息:', request.action || request.type);
    
    // 处理AI回复生成请求
    if (request.action === 'generate-reply') {
        const { hotelInfo, reviewContent } = request;
        
        chrome.storage.local.get(['isActivated', 'licenseKey', 'settings'], (data) => {
            // 如果本地未激活或没有授权码，直接返回提示
            if (!data.isActivated || !data.licenseKey) {
                return sendResponse({ 
                    success: true, 
                    reply: `尊敬的顾客您好！\n\n感谢您的评价。我们非常重视您的反馈，并将继续努力提升服务质量。期待您的再次光临！\n\n[提示：请先激活授权码以获取完整AI功能]`
                });
            }

            // 如果本地已激活，则向服务器重新验证授权码
            getOrCreateMachineId(machineId => {
                fetch(VERIFIER_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        licenseKey: data.licenseKey,
                        machineId: machineId
                    })
                })
                .then(response => {
                    if (response.status === 404 || response.status === 403) {
                         throw new Error('授权码已失效或被删除，请重新激活。');
                    }
                    if (!response.ok) {
                        throw new Error(`验证服务器错误: ${response.status}`);
                    }
                    return response.json();
                })
                .then(verificationData => {
                    // 如果服务器确认授权码无效，则抛出错误
                    if (!verificationData.valid) {
                        throw new Error(verificationData.message || '授权码已失效，请重新激活。');
                    }

                    // 授权码仍然有效，继续生成AI回复
                    const settings = data.settings || {};
                    const messages = [
                        {
                            role: "system",
                            content: `你是一个专业的酒店客服代表。请使用${hotelInfo.tone === 'friendly' ? '友好亲切' : 
                                hotelInfo.tone === 'professional' ? '专业礼貌' : 
                                hotelInfo.tone === 'apologetic' ? '真诚道歉' : 
                                hotelInfo.tone === 'humorous' ? '轻松幽默' : '专业礼貌'}的语气回复客人的评价。
                                ${settings.hotelName ? `酒店名称或自称：${settings.hotelName}` : ''}
                                ${settings.hotelPhone ? `联系电话：${settings.hotelPhone}` : ''}
                                ${settings.mustInclude ? `回复中必须包含以下信息或围绕这些点展开：${settings.mustInclude}` : ''}
                                ${settings.forbiddenWords ? `回复中绝对不允许出现以下词汇（或其同义词）：${settings.forbiddenWords}` : ''}
                                
                                重要规则：
                                1. 不要在回复中包含日期。
                                2. 直接给出最终的、完整的回复内容，不要包含任何你的思考过程、草稿或标记（如<think>）。
                                3. 不要使用"客服"或类似署名。
                                4. ${settings.forbiddenWords ? `严格禁止使用以下词汇：${settings.forbiddenWords}` : ''}`
                        },
                        { role: "user", content: `客人评价：${reviewContent}\n请生成回复` }
                    ];

                    return fetch(API_HOST, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
                        body: JSON.stringify({ model: API_MODEL, messages: messages, temperature: 0.7, max_tokens: 1000 })
                    });
                })
                .then(aiResponse => {
                    if (!aiResponse.ok) { throw new Error(`AI服务器错误: ${aiResponse.status}`); }
                    return aiResponse.json();
                })
                .then(aiData => {
                    if (aiData.choices && aiData.choices[0] && aiData.choices[0].message) {
                        let reply = aiData.choices[0].message.content.trim();
                        reply = reply.replace(/<think>[\s\S]*?<\/think>/, '').trim();
                        sendResponse({ success: true, reply: reply });
                    } else {
                        throw new Error('无效的AI响应格式');
                    }
                })
                .catch(error => {
                    console.error('操作失败:', error.message);
                    // 只要发生错误（无论是验证失败还是AI生成失败），都禁用插件并通知用户
                    chrome.storage.local.set({ isActivated: false });
                    sendResponse({ success: false, message: error.message });
                });
            });
        });
        
        return true; // 保持消息通道开放以进行异步响应
    } 
    // 处理授权验证请求
    else if (request.action === 'verify-license') {
        console.log('收到授权验证请求:', request.key);
        
        getOrCreateMachineId(machineId => {
            console.log('使用机器ID:', machineId);
            
            fetch(VERIFIER_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    licenseKey: request.key,
                    machineId: machineId
                })
            })
            .then(response => {
                console.log('验证服务器响应状态:', response.status);
                if (!response.ok) {
                    throw new Error(`服务器错误: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('验证结果:', data);
                sendResponse(data);
            })
            .catch(error => {
                console.error('验证请求失败:', error);
                sendResponse({
                    success: false,
                    message: `激活请求失败: ${error.message}`
                });
            });
        });
        
        return true; // 保持消息通道开放
    }
});

// 在浏览器启动时注入到所有匹配的标签页
chrome.runtime.onStartup.addListener(() => {
    addLog('浏览器启动，检查已打开的标签页');
    
    // 获取存储的启用状态
    chrome.storage.local.get(['enabled'], (result) => {
        const isEnabled = result.enabled !== false; // 默认为true
        
        addLog(`当前扩展状态: ${isEnabled ? '启用' : '禁用'}`);
        
        if (isEnabled) {
            // 查询所有标签页
            chrome.tabs.query({}, (tabs) => {
                // 过滤出目标网站标签页
                const targetTabs = tabs.filter(tab => isTargetWebsite(tab.url));
                
                addLog(`找到 ${targetTabs.length} 个目标网站标签页`);
                
                // 为每个标签页注入脚本
                targetTabs.forEach(tab => {
                    injectContentScript(tab.id)
                        .then(result => {
                            if (result && result.success) {
                                addLog(`脚本成功注入到标签页 ${tab.id}`);
                            } else {
                                addLog(`脚本注入失败: ${result?.reason || '未知原因'}`);
                            }
                        })
                        .catch(error => {
                            addLog(`脚本注入出错: ${error.message}`);
                        });
                });
            });
        } else {
            addLog(`扩展当前已禁用，不注入脚本`);
        }
    });
});

// 连接状态保持
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "keepAlive") {
        sendResponse({status: "alive"});
    }
    return true;
}); 