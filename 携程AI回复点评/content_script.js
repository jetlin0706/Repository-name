/**
 * @file 携程/美团 AI回复助手内容脚本
 * @version 6.1.1 (修复对话框和美团按钮问题)
 */

(() => {
    if (window.aiReplyScriptLoaded) {
        return;
    }
    window.aiReplyScriptLoaded = true;
    
    let commentObserver = null;
    let injectionTimeout = null;

    function sendLog(message) {
        console.log(`[AI助手 v6.1.1] ${message}`);
    }
    
    // --- 核心生命周期函数 ---
    
    function startInjection() {
        sendLog('启动功能注入...');
        injectStyles();
        createAiReplyModal();
        runButtonInjection();
        startObserver();
    }
    
    function stopInjection() {
        sendLog('停止所有功能...');
        removeAllButtons();
        stopObserver();
    }
    
    // --- 观察者管理 ---

    function startObserver() {
        if (commentObserver) commentObserver.disconnect();
        
        commentObserver = new MutationObserver(() => {
            clearTimeout(injectionTimeout);
            injectionTimeout = setTimeout(runButtonInjection, 500);
        });

        commentObserver.observe(document.body, { childList: true, subtree: true });
        sendLog("MutationObserver已启动");
    }
    
    function stopObserver() {
        if (commentObserver) {
            commentObserver.disconnect();
            commentObserver = null;
            sendLog("MutationObserver已停止");
        }
    }
    
    // --- 按钮注入逻辑 ---

    function runButtonInjection() {
        if (window.location.host.includes('meituan.com')) {
            addButtonsToMeituan();
        } else {
            addButtonsToCtrip();
        }
    }

    function addButtonsToCtrip() {
        document.querySelectorAll('.ct61sa9').forEach(item => {
            if (item.querySelector('.ai-reply-button-link-ctrip')) return;
            const anchor = item.querySelector('.c1whp6lz');
            if (anchor) {
                // 尝试用主要选择器获取评论
                let commentEl = item.querySelector('.cjigdfr p.r14');
                let commentText = commentEl ? commentEl.textContent.trim() : '';

                // 如果主要选择器没取到内容，尝试后备选择器
                if (!commentText) {
                    const fallbackCommentEl = item.querySelector('.c14x9pna');
                    if (fallbackCommentEl) {
                        commentText = fallbackCommentEl.textContent.trim();
                    }
                }
                
                // 如果还是没有，则使用默认文本
                const finalCommentText = commentText || "未能提取评论内容";

                const aiLink = document.createElement('a');
                aiLink.className = 'he-trip-kit-ui-typography ai-reply-button-link-ctrip';
                aiLink.style.cssText = `display: block; margin-top: 8px; color: #4776E6; cursor: pointer; text-decoration: none; font-weight: bold;`;
                aiLink.innerHTML = `<img src="${chrome.runtime.getURL('icons/ai-icon.svg')}" alt="AI" style="width: 16px; height: 16px; vertical-align: -3px; margin-right: 4px;">AI智能回复`;
                
                aiLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    showAiReplyModal(finalCommentText);
                });
                anchor.appendChild(aiLink);
            }
        });
    }
    
    function addButtonsToMeituan() {
        document.querySelectorAll('.feedback-list__item').forEach(item => {
            if (item.querySelector('.ai-reply-button-link-meituan')) return;

            // 查找"回复"或"修改回复"的容器作为锚点
            const replyBtn = item.querySelector('a.feedback-list__item-reply');
            const modifyContainer = item.querySelector('.reply-time');
            
            const anchor = replyBtn ? replyBtn.parentNode : modifyContainer;
            if (anchor) {
                const commentEl = item.querySelector('.feedback-list__item-comment');
                const commentText = commentEl ? commentEl.textContent.trim() : "未能提取评论内容";

                const aiLink = document.createElement('a');
                aiLink.className = 'ai-reply-button-link-meituan';
                aiLink.href = 'javascript:;';
                aiLink.style.cssText = `margin-left: 10px; color: #4776E6; text-decoration: none; font-weight: bold;`;
                aiLink.innerHTML = `<img src="${chrome.runtime.getURL('icons/ai-icon.svg')}" alt="AI" style="width: 14px; height: 14px; vertical-align: -2px; margin-right: 4px;">AI智能回复`;
                
                aiLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    showAiReplyModal(commentText);
                });
                
                if(replyBtn) { // 如果是"回复"按钮，插在它后面
                     anchor.insertBefore(aiLink, replyBtn.nextSibling);
                } else { // 否则，追加到"修改回复"容器里
                    anchor.appendChild(aiLink);
                }
            }
        });
    }

    // --- UI创建与管理 ---

    function removeAllButtons() {
        document.querySelectorAll('.ai-reply-button-link-ctrip, .ai-reply-button-link-meituan').forEach(btn => btn.remove());
        sendLog(`已移除所有AI按钮`);
    }

    function createAiReplyModal() {
        if (document.getElementById('ai-reply-modal-container')) return;
        
        const modal = document.createElement('div');
        modal.id = 'ai-reply-modal-container';
        
        modal.innerHTML = `
            <div id="ai-reply-dialog">
                <div class="ai-modal-header">
                    <h3><img src="${chrome.runtime.getURL('icons/ai-icon.svg')}" alt="AI"> AI 回复助手</h3>
                    <button id="ai-modal-close" title="关闭">&times;</button>
                </div>
                <div class="ai-modal-body">
                    <div class="ai-modal-section">
                        <label>客人评论预览:</label>
                        <div id="ai-comment-preview"></div>
                    </div>
                    <div class="ai-modal-section">
                        <label>选择回复语气:</label>
                        <div id="ai-tone-selector">
                            <button class="tone-button" data-tone="friendly"><img src="${chrome.runtime.getURL('icons/friendly.svg')}">友好亲切</button>
                            <button class="tone-button" data-tone="professional">专业礼貌</button>
                            <button class="tone-button" data-tone="apologetic">真诚道歉</button>
                            <button class="tone-button" data-tone="humorous"><img src="${chrome.runtime.getURL('icons/humorous.svg')}">轻松幽默</button>
                        </div>
                    </div>
                    <div class="ai-modal-section">
                        <label>AI 生成回复:</label>
                        <div id="ai-reply-output">
                            <div id="ai-loading-indicator">
                                <div class="spinner"></div>
                                <span>正在生成, 请稍候...</span>
                            </div>
                            <textarea id="ai-reply-text" spellcheck="false"></textarea>
                        </div>
                    </div>
                </div>
                <div class="ai-modal-footer">
                    <button id="ai-regenerate" class="ai-button-secondary">重新生成</button>
                    <button id="ai-copy" class="ai-button-primary">复制并关闭</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // 事件监听
        document.getElementById('ai-modal-close').addEventListener('click', () => modal.style.display = 'none');
        
        document.getElementById('ai-copy').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const textarea = document.getElementById('ai-reply-text');
            const textToCopy = textarea.value;
            
            // 立即隐藏对话框
            modal.style.display = 'none';
            
            if (!textToCopy) return;

            // 尝试使用现代 Clipboard API
            navigator.clipboard.writeText(textToCopy).catch(err => {
                sendLog(`现代剪贴板API失败: ${err.message}。尝试使用备用方法。`);
                
                // --- 备用复制方法 ---
                try {
                    const fallbackTextArea = document.createElement("textarea");
                    fallbackTextArea.value = textToCopy;
                    fallbackTextArea.style.position = "fixed";
                    fallbackTextArea.style.top = "-9999px";
                    fallbackTextArea.style.left = "-9999px";
                    document.body.appendChild(fallbackTextArea);
                    fallbackTextArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(fallbackTextArea);
                    sendLog('已使用备用方法成功复制。');
                } catch (fallbackErr) {
                    sendLog(`备用复制方法也失败了: ${fallbackErr.message}`);
                }
            });
        });

        document.querySelectorAll('.tone-button').forEach(button => {
            button.addEventListener('click', function() {
                const commentText = document.getElementById('ai-comment-preview').textContent;
                const tone = this.getAttribute('data-tone');
                generateAiReply(commentText, tone);
            });
        });
        document.getElementById('ai-regenerate').addEventListener('click', () => {
             const commentText = document.getElementById('ai-comment-preview').textContent;
             const selectedTone = document.querySelector('.tone-button.selected')?.getAttribute('data-tone');
             if(selectedTone) generateAiReply(commentText, selectedTone);
        });

        sendLog('AI回复对话框已创建');
    }

    function showAiReplyModal(commentText) {
        const modal = document.getElementById('ai-reply-modal-container');
        if (!modal) return;
        
        document.getElementById('ai-comment-preview').textContent = commentText;
        document.getElementById('ai-reply-text').value = '';
        
        // 确保打开时是非加载状态
        const replyOutput = document.getElementById('ai-reply-output');
        replyOutput.classList.remove('loading');
        replyOutput.classList.add('loaded');

        modal.style.display = 'flex';
        // 默认触发第一个语气按钮
        const firstToneButton = document.querySelector('.tone-button');
        if(firstToneButton) {
            // 清除旧的选择
            document.querySelectorAll('.tone-button.selected').forEach(b => b.classList.remove('selected'));
            firstToneButton.click();
        }
    }
    
    function generateAiReply(commentText, tone) {
        const replyOutput = document.getElementById('ai-reply-output');
        const replyText = document.getElementById('ai-reply-text');
        
        // 进入加载状态
        replyOutput.classList.remove('loaded');
        replyOutput.classList.add('loading');
        replyText.value = '';

        document.querySelectorAll('.tone-button').forEach(btn => btn.classList.remove('selected'));
        const selectedBtn = document.querySelector(`.tone-button[data-tone="${tone}"]`);
        if(selectedBtn) selectedBtn.classList.add('selected');

        // 在通信前检查上下文是否有效
        if (!chrome.runtime?.id) {
            sendLog("扩展上下文已失效，无法获取AI回复。");
            replyText.value = "生成回复失败，请刷新页面或重新打开对话框重试。";
            replyOutput.classList.remove('loading');
            replyOutput.classList.add('loaded');
            return;
        }

        chrome.runtime.sendMessage({
            action: 'getAiReply',
            tone: tone,
            commentText: commentText
        }, response => {
            if (chrome.runtime.lastError) {
                sendLog(`获取AI回复时出错: ${chrome.runtime.lastError.message}`);
                replyText.value = `生成回复失败。可能是插件已更新，请刷新页面或重新打开对话框重试。`;
            } else if (response && response.success) {
                replyText.value = response.reply;
            } else {
                replyText.value = `生成回复失败: ${response.message || '未知错误'}`;
            }
            // 结束加载状态
            replyOutput.classList.remove('loading');
            replyOutput.classList.add('loaded');
        });
    }

    function injectStyles() {
        const styleId = 'ai-reply-styles';
        if (document.getElementById(styleId)) return;
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            #ai-reply-modal-container { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); z-index: 10001; align-items: center; justify-content: center; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
            .tone-button { padding: 8px 12px; border: 1px solid #ddd; border-radius: 18px; background: #fff; cursor: pointer; transition: all 0.2s ease-in-out; display: inline-flex; align-items: center; gap: 6px; }
            .tone-button:hover { background-color: #f0f0f0; border-color: #ccc; }
            .tone-button.selected { background-color: #4A90E2; color: white; border-color: #4A90E2; font-weight: bold; }
            .tone-button img { width: 16px; height: 16px; }
        `;
        document.head.appendChild(style);
    }

    // --- 消息监听与初始化 ---
    
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        // 在处理消息前检查上下文是否有效
        if (!chrome.runtime?.id) {
            sendLog("扩展上下文已失效，停止处理消息。");
            return;
        }
        
        if (message.action === 'statusChanged') {
            if (message.enabled) {
                startInjection();
            } else {
                stopInjection();
            }
        }
        sendResponse({status: 'ok'});
        return true; 
    });

    // 在初始化时检查上下文是否有效
    if (chrome.runtime?.id) {
        chrome.storage.local.get(['enabled'], (result) => {
            // 再次检查，因为在异步回调中上下文可能已失效
            if (chrome.runtime?.id && result.enabled !== false) {
                startInjection();
            }
        });
    }

})();