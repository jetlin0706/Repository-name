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

// 监听来自内容脚本和弹出窗口的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
        addLog(`收到消息: ${message.action}`);
        
        if (message.action === 'log') {
            addLog(`[内容脚本] ${message.message}`);
            sendResponse({status: 'logged'});
        }
        
        else if (message.action === 'getLogs') {
            sendResponse({logs: logs});
        }
        
        else if (message.action === 'getStatus') {
            chrome.storage.local.get(['enabled'], (result) => {
                const isEnabled = result.enabled !== false; // 默认为true
                addLog(`返回扩展状态: ${isEnabled ? '启用' : '禁用'}`);
                sendResponse({enabled: isEnabled});
            });
            return true; // 保持消息通道开放，以便异步响应
        }
        
        else if (message.action === 'setStatus') {
            const newStatus = message.enabled;
            addLog(`设置扩展状态: ${newStatus ? '启用' : '禁用'}`);
            
            chrome.storage.local.set({enabled: newStatus}, () => {
                // 向所有匹配的标签页发送状态更新消息
                chrome.tabs.query({}, (tabs) => {
                    tabs.forEach(tab => {
                        if (isTargetWebsite(tab.url)) {
                            try {
                                chrome.tabs.sendMessage(tab.id, {
                                    action: 'statusChanged',
                                    enabled: newStatus
                                });
                                addLog(`已发送状态更新消息到标签页 ${tab.id}`);
                            } catch (e) {
                                addLog(`发送消息到标签页 ${tab.id} 失败: ${e.message}`);
                }
                        }
                    });
                });
                
                sendResponse({status: 'success', enabled: newStatus});
            });
            return true; // 保持消息通道开放，以便异步响应
        }
        
        else if (message.action === 'injectScript') {
            const tabId = message.tabId;
            
            injectContentScript(tabId)
                .then(result => {
                    sendResponse(result);
                })
                .catch(error => {
                    sendResponse({success: false, message: error.message});
                });
            
            return true; // 保持消息通道开放，以便异步响应
        }
        
        else if (message.action === 'removeScript') {
            const tabId = message.tabId;
            addLog(`尝试从标签页 ${tabId} 移除脚本`);
            
            try {
                // 向内容脚本发送移除消息
                chrome.tabs.sendMessage(tabId, {action: 'removeAiFeatures'}, (response) => {
                    if (chrome.runtime.lastError) {
                        addLog(`无法发送移除消息: ${chrome.runtime.lastError.message}`);
                        sendResponse({status: 'warning', message: '无法与内容脚本通信，可能脚本未加载'});
                } else {
                        addLog(`已发送移除消息到标签页 ${tabId}`);
                        sendResponse({status: 'success'});
                }
                });
            } catch (e) {
                addLog(`发送移除消息失败: ${e.message}`);
                sendResponse({status: 'error', message: e.message});
            }
            
            return true; // 保持消息通道开放，以便异步响应
        }
        
        // AI对话相关请求处理
        else if (message.action === 'getAiReply') {
            handleGetAiReply(message)
                .then(result => {
                    sendResponse(result);
                })
                .catch(error => {
                    sendResponse({success: false, message: error.message});
                });
            
            return true; // 保持消息通道开放，以便异步响应
        }
        
        // 保存设置
        else if (message.action === 'saveSettings') {
            chrome.storage.local.set(message.settings, () => {
                addLog(`已保存设置: ${JSON.stringify(message.settings)}`);
                sendResponse({status: 'success'});
            });
            return true; // 保持消息通道开放，以便异步响应
        }
        
        // 获取设置
        else if (message.action === 'getSettings') {
            chrome.storage.local.get(['hotelName', 'hotelPhone', 'mustInclude'], (result) => {
                addLog(`返回设置: ${JSON.stringify(result)}`);
                sendResponse({settings: result});
            });
            return true; // 保持消息通道开放，以便异步响应
        }
    } catch (error) {
        addLog(`处理消息出错: ${error.message}`);
        sendResponse({status: 'error', message: error.message});
    }
});

// 授权验证API地址
const VERIFIER_URL = 'https://ai-reply-proxy-new.jetlin0706.workers.dev/api/verify';

// 处理AI回复生成请求
async function handleGetAiReply(request) {
    const { tone, commentText } = request;
    addLog(`收到AI回复请求: [语气: ${tone}]`);

    try {
        // 授权检查
        const activationStatus = await new Promise(resolve => {
            chrome.storage.local.get(['isActivated', 'licenseKey'], result => resolve(result));
        });

        if (activationStatus.isActivated !== true) {
            addLog("拒绝AI回复请求：未授权");
            return { success: false, message: "你的AI点评回复助手已禁用，如需开通使用，请联系开发者。" };
        }

        // === 新增：每次AI调用前实时校验激活码 ===
        const licenseKey = activationStatus.licenseKey;
        if (!licenseKey) {
            addLog("本地未找到授权码，拒绝AI回复请求");
            return { success: false, message: "你的AI点评回复助手已禁用，如需开通使用，请联系开发者。" };
        }
        // 实时向后端校验激活码
        let verifyResult;
        try {
            const verifyResp = await fetch(VERIFIER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ licenseKey })
            });
            verifyResult = await verifyResp.json();
        } catch (e) {
            addLog(`激活码校验请求失败: ${e.message}`);
            return { success: false, message: "你的AI点评回复助手已禁用，如需开通使用，请联系开发者。" };
        }
        if (!verifyResult || !verifyResult.valid) {
            addLog(`激活码实时校验失败: ${verifyResult?.message || '无效授权码'}`);
            await chrome.storage.local.set({ isActivated: false });
            return { success: false, message: "你的AI点评回复助手已禁用，如需开通使用，请联系开发者。" };
        }
        // === 实时校验通过，继续AI回复 ===

        const settings = await new Promise((resolve, reject) => {
            chrome.storage.local.get(['hotelName', 'hotelPhone', 'mustInclude'], (result) => {
                if (chrome.runtime.lastError) {
                    return reject(chrome.runtime.lastError);
            }
                resolve(result);
            });
        });
        
        const systemPrompt = getSystemPrompt(tone, settings);
        
        let userPrompt = `这是客人的评论: "${commentText}"`;
        if (settings.mustInclude) {
            userPrompt += `\n\n请在回复中自然地包含以下信息: "${settings.mustInclude}"`;
        }

        const reply = await callQwenAPI(systemPrompt, userPrompt);
        addLog(`成功获取AI回复`);
        return { success: true, reply };

    } catch (error) {
        const errorMsg = `处理AI回复请求失败: ${error.message}`;
        addLog(errorMsg);
        return { success: false, message: errorMsg };
    }
}

// 根据不同语气生成系统提示词
function getSystemPrompt(tone, settings) {
    const hotelName = settings.hotelName || '我们酒店';
    let prompt = `你是一个专业的酒店客服经理，你的任务是根据客人的评论生成回复。你的回复必须始终以"${hotelName}"的身份进行。`;

    switch (tone) {
        case 'friendly':
            prompt += `
请使用友好亲切、热情洋溢的语气。可以多使用一些积极的形容词和口语化的表达，让客人感觉温暖。
例如，可以使用"亲爱的顾客"、"非常感谢您的光临"、"期待您的再次到来哦~"等。如果合适，可以适当使用可爱的表情符号(Emoji)。`;
            break;
        case 'professional':
            prompt += `
请使用专业、礼貌、严谨的语气。措辞要正式，体现出酒店的专业管理水平。
回复结构要清晰，例如先表示感谢，然后针对评论内容进行回应，最后致以祝愿。避免使用网络流行语和过多表情。`;
            break;

        case 'apologetic':
            prompt += `
请使用真诚、歉意的语气。这通常用于回应客人的负面评价。
回复时，首先要对客人不佳的体验表示诚挚的歉意，不要找借口。然后，如果可能，针对客人提出的具体问题说明酒店将如何改进。最后，再次表达歉意并欢迎客人再次光临以体验改进。
例如："对于您遇到的问题，我们深表歉意..."、"我们已经立刻着手调查并处理..."`;
            break;
        case 'humorous':
            prompt += `
请使用轻松、幽默、风趣的语气。可以适当使用网络流行语、玩梗或者自嘲，拉近与年轻顾客的距离。
注意，幽默不等于不礼貌，在保持风趣的同时，依然要传达出对客人的尊重和感谢。可以根据评论内容进行有趣的互动。`;
            break;
        default:
            prompt += `
请使用默认的友好且专业的语气进行回复。`;
            break;
    }
    
    if (settings.hotelPhone) {
        prompt += `\n如果回复内容适合，可以在结尾处附上酒店电话：${settings.hotelPhone}，方便客人直接联系。`;
    }

    prompt += `

 **重要规则：**
 1.  **直接生成回复**：你的输出内容必须直接是给客人的回复，不要包含任何思考过程、解释、或类似于 "<think>" 这样的标签。
 2.  **不要包含日期**：回复中绝对不能包含或引用客人评论的发表日期或时间。回复应该是通用的，不指明具体时间。
 3.  **专注于评论内容**：你的回复应该只针对客人评论中提到的体验，而不是评论本身（比如不要说"看到您X月X日的评论"）。`;

    return prompt;
}

// 调用通义千问API
async function callQwenAPI(systemPrompt, userPrompt) {
    addLog("开始调用通义千问API...");
    try {
        const response = await fetch(API_HOST, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: API_MODEL,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                max_tokens: 1000,
                temperature: 0.7
            })
        });
        
        if (!response.ok) {
            // 如果是401错误，返回特定的友好提示
            if (response.status === 401) {
                throw new Error("尊敬的合作伙伴，您的API额度可能已用完，请联系服务商进行充值。");
            }
            const errorText = await response.text();
            throw new Error(`API请求失败: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();

        if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
            const replyContent = data.choices[0].message.content;
            addLog("成功从API响应中提取回复内容。");

            // 移除AI回复中可能包含的思考过程
            const cleanedReply = replyContent.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

            if (cleanedReply.length < replyContent.length) {
                addLog("已过滤并移除AI回复中的思考过程内容。");
            }

            return cleanedReply;
        } else {
            addLog("API响应格式不正确，缺少回复内容。");
            throw new Error("API响应格式不正确，无法找到回复内容。");
        }

    } catch (error) {
        addLog(`API调用出错: ${error.message}`);
        // 将原始错误再次抛出，以便上层函数可以捕获
        throw error;
    }
}

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