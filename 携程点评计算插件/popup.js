document.addEventListener('DOMContentLoaded', function() {
    // 获取页面元素
    const getDataBtn = document.getElementById('getData');
    const calculateBtn = document.getElementById('calculate');
    const currentScoreInput = document.getElementById('currentScore');
    const totalReviewsInput = document.getElementById('totalReviews');
    const targetScoreInput = document.getElementById('targetScore');
    const resultDiv = document.getElementById('result');
    const errorDiv = document.getElementById('error');

    // 从页面获取数据
    getDataBtn.addEventListener('click', async function() {
        // 禁用按钮，显示加载状态
        getDataBtn.disabled = true;
        getDataBtn.textContent = '正在获取数据...';
        
        try {
            const tabs = await chrome.tabs.query({active: true, currentWindow: true});

            if (!tabs || !tabs[0]) {
                throw new Error('无法获取当前标签页信息');
            }

            const tabId = tabs[0].id;
            const url = tabs[0].url;
            
            if (!url || !url.includes('ebooking.ctrip.com/comment/commentList')) {
                throw new Error('请在携程eBooking的订单点评页面使用此插件');
            }

            const injectionResults = await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content.js']
            });

            // executeScript 会返回一个数组，每个元素是对应注入脚本的返回结果
            // 这里我们只有一个脚本，所以取第一个结果
            if (!injectionResults || injectionResults.length === 0 || !injectionResults[0].result) {
                throw new Error('无法从页面获取数据，请确保页面已完全加载。');
            }

            const response = injectionResults[0].result;

            // 验证响应数据
            if (!response.success) {
                throw new Error(response.message || '获取数据失败');
            }

            // 验证数据的合理性
            const score = parseFloat(response.currentScore);
            const reviews = parseInt(response.totalReviews);

            if (isNaN(score) || score <= 0 || score > 5) {
                throw new Error('获取到的评分数据无效');
            }

            if (isNaN(reviews) || reviews < 0) { // 点评数可以为0
                throw new Error('获取到的点评数据无效');
            }

            // 更新输入框
            currentScoreInput.value = score.toFixed(1);
            totalReviewsInput.value = reviews;
            
            // 显示成功消息
            showMessage('success', '数据获取成功！');

        } catch (error) {
            console.error('获取数据时出错:', error);
            showMessage('error', error.message || '获取数据失败，请刷新页面后重试');
        } finally {
            // 恢复按钮状态
            resetGetDataButton();
        }
    });

    // 重置获取数据按钮状态
    function resetGetDataButton() {
        getDataBtn.disabled = false;
        getDataBtn.textContent = '获取当前页面数据';
    }

    // 计算所需点评数
    calculateBtn.addEventListener('click', function() {
        try {
            // 获取输入值
            const currentScore = parseFloat(currentScoreInput.value);
            const totalReviews = parseInt(totalReviewsInput.value);
            const targetScore = parseFloat(targetScoreInput.value);
            resultDiv.style.display = 'none'; // 每次计算前先隐藏旧结果

            // 输入验证
            if (!validateInputs(currentScore, totalReviews, targetScore)) {
                return;
            }

            // 定义点评类型和权重
            const reviewTypes = [
                { name: '高等级会员+带图', weight: 2.0 },
                { name: '带图/长文本', weight: 1.5 },
                { name: '普通文字好评', weight: 1.0 }
            ];

            const results = reviewTypes.map(type => {
                // 检查目标分数是否可达
                if (targetScore >= 5 * type.weight) {
                    return {
                        name: `${type.name} (权重 ${type.weight})`,
                        required: -1,
                    };
                }
                const required = calculateRequiredReviews(currentScore, totalReviews, targetScore, type.weight);
                return {
                    name: `${type.name} (权重 ${type.weight})`,
                    required: required
                };
            });

            // 显示结果
            displayResult(results, currentScore, totalReviews, targetScore);
            
        } catch (error) {
            console.error('计算过程出错:', error);
            showMessage('error', '计算过程出错，请检查输入数据');
        }
    });

    // 输入验证函数
    function validateInputs(currentScore, totalReviews, targetScore) {
        // 清除之前的错误消息
        errorDiv.style.display = 'none';

        if (isNaN(currentScore) || currentScore < 0 || currentScore > 5) {
            showMessage('error', '当前评分必须在0-5分之间');
            return false;
        }
        if (isNaN(totalReviews) || totalReviews <= 0) {
            showMessage('error', '当前点评数必须是大于0的整数');
            return false;
        }
        if (isNaN(targetScore) || targetScore < 0 || targetScore > 5) {
            showMessage('error', '目标评分必须在0-5分之间');
            return false;
        }
        if (targetScore <= currentScore) {
            showMessage('error', '目标评分必须高于当前评分');
            return false;
        }
        return true;
    }

    // 显示消息函数
    function showMessage(type, message) {
        errorDiv.textContent = message;
        errorDiv.className = `message ${type}`;
        errorDiv.style.display = 'block';
        
        // 如果不是错误消息，3秒后自动隐藏
        if (type !== 'error') {
            setTimeout(() => {
                errorDiv.style.display = 'none';
            }, 3000);
        }
    }

    // 定义评分权重模型
    const RatingWeightModel = {
        // 时间衰减因子 (近期点评权重更高)
        timeDecay: (daysAgo) => {
            return Math.exp(-0.001 * daysAgo); // 降低衰减速率，使得较早的点评仍有一定权重
        },

        // 用户可信度权重
        userCredibility: {
            member: {
                platinum: 3.0,    // 白金会员权重提升
                gold: 2.5,        // 金牌会员权重提升
                silver: 2.0,      // 银牌会员权重提升
                regular: 1.0      // 普通会员基准权重
            },
            verificationStatus: {
                verified: 1.5,    // 已验证用户权重提升
                unverified: 0.6   // 未验证用户权重降低
            }
        },

        // 点评质量权重
        reviewQuality: {
            withPhoto: 2.5,       // 带图点评权重提升
            withVideo: 3.0,       // 带视频点评权重提升
            detailed: 1.8,        // 详细点评权重提升
            multiDimension: 1.5,  // 多维度评价权重提升
            basicText: 1.0        // 基础文字点评基准权重
        },

        // 时间新鲜度权重
        freshness: {
            within7days: 2.0,     // 7天内权重提升
            within30days: 1.8,    // 30天内权重提升
            within90days: 1.5,    // 90天内权重提升
            within180days: 1.2,   // 180天内权重提升
            within365days: 1.0,   // 365天内基准权重
            older: 0.8            // 更早权重降低
        },

        // 点评有效性权重
        validity: {
            normal: 1.0,          // 正常点评基准权重
            suspicious: 0.3,      // 可疑点评权重大幅降低
            invalid: 0            // 无效点评零权重
        }
    };

    // 计算所需点评数函数（新版）
    function calculateRequiredReviews(currentScore, totalReviews, targetScore, weight) {
        // 公式: x = (总点评数 * (目标分 - 当前分)) / (5 * 权重 - 目标分)
        const numerator = totalReviews * (targetScore - currentScore);
        const denominator = (5 * weight) - targetScore;

        if (denominator <= 0) {
            return -1; // 目标分数无法达到
        }

        const required = numerator / denominator;
        return parseFloat(required.toFixed(2));
    }

    // 显示结果函数
    function displayResult(results, currentScore, totalReviews, targetScore) {
        const resultDiv = document.getElementById('result');
        resultDiv.style.display = 'block';
        
        let validPlans = 0;
        let resultsHtml = `
            <div class="result-header">
                <h3>评分提升方案</h3>
                <p>从 <strong>${currentScore.toFixed(2)}分</strong> (${totalReviews}条) 提升至 <strong>${targetScore.toFixed(2)}分</strong>, 可任选以下方案:</p>
                <p class="note">注意：此计算为理论值，基于简化的权重模型，实际情况可能因携程算法微调而有差异。</p>
            </div>
        `;

        results.forEach(result => {
            if (result.required >= 0) {
                resultsHtml += `
                    <div class="plan-card">
                        <div class="plan-name">${result.name}</div>
                        <div class="plan-details">
                            <span>需要新增</span>
                            <strong>${Math.ceil(result.required)}</strong>
                            <span>条5星好评</span>
                        </div>
                    </div>
                `;
                validPlans++;
            }
        });

        if (validPlans === 0) {
            resultsHtml += `<div class="no-plan">所有方案均无法达到目标评分。</div>`;
        }

        resultDiv.innerHTML = resultsHtml;
    }
}); 