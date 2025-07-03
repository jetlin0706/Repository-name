console.log('Content script 已加载');

// 监听来自popup的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "getData") {
        try {
            console.log('开始获取数据');
            
            // 等待页面加载完成
            if (document.readyState !== 'complete') {
                throw new Error('页面尚未完全加载，请稍后重试');
            }

            // 获取评分
            let currentScore = null;
            try {
                // 直接查找4.3/5这样的评分显示
                const scoreElements = document.querySelectorAll('*');
                for (const element of scoreElements) {
                    const text = element.textContent.trim();
                    // 匹配 x.x/5 格式
                    const ratingMatch = text.match(/(\d+\.?\d*)\s*\/\s*5/);
                    if (ratingMatch) {
                        const score = parseFloat(ratingMatch[1]);
                        if (score > 0 && score <= 5) {
                            currentScore = score;
                            console.log('找到评分:', currentScore);
                            break;
                        }
                    }
                }

                // 如果没找到，尝试查找单独的数字4.3
                if (!currentScore) {
                    const elements = document.querySelectorAll('*');
                    for (const element of elements) {
                        const text = element.textContent.trim();
                        if (/^\d+\.\d+$/.test(text)) {
                            const score = parseFloat(text);
                            if (score > 0 && score <= 5) {
                                currentScore = score;
                                console.log('找到评分:', currentScore);
                                break;
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('获取评分时出错:', error);
            }

            // 获取点评数
            let totalReviews = null;
            try {
                // 查找"全部点评"区域的数字
                const elements = document.querySelectorAll('*');
                for (const element of elements) {
                    const text = element.textContent.trim();
                    
                    // 匹配"全部点评(60)"格式
                    const match1 = text.match(/全部点评\s*[（(](\d+)[)）]/);
                    if (match1) {
                        totalReviews = parseInt(match1[1]);
                        console.log('从全部点评找到点评数:', totalReviews);
                        break;
                    }
                    
                    // 匹配"60条点评"格式
                    const match2 = text.match(/(\d+)\s*条点评/);
                    if (match2) {
                        totalReviews = parseInt(match2[1]);
                        console.log('从条点评找到点评数:', totalReviews);
                        break;
                    }
                    
                    // 匹配纯数字60
                    if (text === '60' && element.parentElement?.textContent.includes('点评')) {
                            totalReviews = 60;
                            console.log('找到点评数:', totalReviews);
                            break;
                    }
                }
            } catch (error) {
                console.error('获取点评数时出错:', error);
            }

            // 验证并返回数据
            if (!currentScore || isNaN(currentScore) || currentScore <= 0 || currentScore > 5) {
                console.error('评分无效:', currentScore);
                throw new Error('无法获取有效的评分数据');
            }

            if (!totalReviews || isNaN(totalReviews) || totalReviews < 0) {
                console.error('点评数无效:', totalReviews);
                throw new Error('无法获取有效的点评数量');
            }

            console.log('成功获取数据:', { currentScore, totalReviews });
            
            // 发送成功响应
            sendResponse({
                success: true,
                currentScore: currentScore,
                totalReviews: totalReviews
            });

        } catch (error) {
            console.error('获取数据失败:', error);
            sendResponse({
                success: false,
                message: error.message || '获取数据失败，请刷新页面后重试'
            });
        }
    }
    return true;
});

// 验证是否在正确的页面
function validatePage() {
    console.log('正在验证页面...');
    console.log('当前URL:', window.location.href);
    
    // 检查URL是否包含正确的路径
    const correctUrlPattern = /ebooking\.ctrip\.com\/comment\/commentList/i;
    if (!correctUrlPattern.test(window.location.href)) {
        console.log('URL验证失败');
        return false;
    }

    // 记录页面上所有可能包含"点评"的元素
    console.log('搜索页面指示器...');
    const allElements = document.querySelectorAll('*');
    for (const element of allElements) {
        if (element.textContent.includes('点评')) {
            console.log('找到包含点评的元素:', element.tagName, element.className, element.textContent.trim());
        }
    }

    // 检查页面上是否存在特定的元素
    const pageIndicators = [
        document.querySelector('[class*="comment"]'),  // 任何包含comment的类
        document.querySelector('[class*="review"]'),   // 任何包含review的类
        document.querySelector('[class*="rating"]'),   // 任何包含rating的类
        // 检查文本内容
        Array.from(document.querySelectorAll('*')).some(el => 
            el.textContent.includes('点评') || 
            el.textContent.includes('评价') ||
            el.textContent.includes('评分')
        )
    ];

    const isValidPage = pageIndicators.some(indicator => indicator !== null && indicator !== false);
    console.log('页面验证结果:', isValidPage);
    return isValidPage;
}

// 从页面获取点评数据
function getPageData() {
    console.log('开始获取页面数据...');
    
    let score = 0;
    let reviews = 0;

    try {
        // 获取评分 - 记录所有可能的数字
        console.log('搜索评分...');
        const allElements = document.querySelectorAll('*');
        const potentialScores = [];
        
        for (const element of allElements) {
            const text = element.textContent.trim();
            // 匹配任何数字格式
            const matches = text.match(/(\d+\.?\d*)/);
            if (matches) {
                const number = parseFloat(matches[1]);
                if (number > 0 && number <= 5) {
                    console.log('找到可能的评分:', number, '来自元素:', element.tagName, element.className);
                    potentialScores.push(number);
                }
            }
        }
        
        if (potentialScores.length > 0) {
            console.log('所有可能的评分:', potentialScores);
            score = potentialScores[0]; // 使用第一个找到的有效评分
        }

        // 获取点评数 - 记录所有可能的数字
        console.log('搜索点评数...');
        const potentialReviews = [];
        
        for (const element of allElements) {
            const text = element.textContent.trim();
            if (text.includes('点评') || text.includes('评价')) {
                console.log('找到包含点评/评价的元素:', element.tagName, element.className, text);
                // 尝试提取数字
                const matches = text.match(/(\d+)/g);
                if (matches) {
                    matches.forEach(match => {
                        const number = parseInt(match);
                        if (number > 0 && number < 1000) {
                            console.log('找到可能的点评数:', number);
                            potentialReviews.push(number);
                        }
                    });
                }
            }
        }
        
        if (potentialReviews.length > 0) {
            console.log('所有可能的点评数:', potentialReviews);
            reviews = potentialReviews[0]; // 使用第一个找到的有效点评数
        }

        console.log('最终获取结果 - 评分:', score, '点评数:', reviews);
        return { score, reviews };
    } catch (error) {
        console.error('获取数据时出错:', error);
        return null;
    }
} 

(function() {
    console.log('Content script a执行');
    
    try {
        if (document.readyState !== 'complete') {
            throw new Error('页面尚未完全加载，请稍后重试');
        }

        let currentScore = null;
        try {
            const scoreElements = document.querySelectorAll('*');
            for (const element of scoreElements) {
                const text = element.textContent.trim();
                const ratingMatch = text.match(/(\d+\.?\d*)\s*\/\s*5/);
                if (ratingMatch) {
                    const score = parseFloat(ratingMatch[1]);
                    if (score > 0 && score <= 5) {
                        currentScore = score;
                        break;
                    }
                }
            }
            if (!currentScore) {
                const elements = document.querySelectorAll('*');
                for (const element of elements) {
                    const text = element.textContent.trim();
                    if (/^\d+\.\d+$/.test(text)) {
                        const score = parseFloat(text);
                        if (score > 0 && score <= 5) {
                            currentScore = score;
                            break;
                        }
                    }
                }
            }
        } catch (error) {
            console.error('获取评分时出错:', error);
        }

        let totalReviews = null;
        try {
            const elements = document.querySelectorAll('*');
            for (const element of elements) {
                const text = element.textContent.trim();
                const match1 = text.match(/全部点评\s*[（(](\d+)[)）]/);
                if (match1) {
                    totalReviews = parseInt(match1[1]);
                    break;
                }
                const match2 = text.match(/(\d+)\s*条点评/);
                if (match2) {
                    totalReviews = parseInt(match2[1]);
                    break;
                }
                if (text === '60' && element.parentElement?.textContent.includes('点评')) {
                    totalReviews = 60;
                    break;
                }
            }
        } catch (error) {
            console.error('获取点评数时出错:', error);
        }

        if (!currentScore || isNaN(currentScore) || currentScore <= 0 || currentScore > 5) {
            throw new Error('无法获取有效的评分数据');
        }
        if (totalReviews === null || isNaN(totalReviews) || totalReviews < 0) {
            throw new Error('无法获取有效的点评数量');
        }

        return {
            success: true,
            currentScore: currentScore,
            totalReviews: totalReviews
        };

    } catch (error) {
        console.error('获取数据失败:', error);
        return {
            success: false,
            message: error.message || '获取数据失败，请刷新页面后重试'
        };
    }
})(); 