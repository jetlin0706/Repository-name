document.addEventListener('DOMContentLoaded', function() {
  // 获取模式切换按钮
  const modeBtns = document.querySelectorAll('.mode-btn');
  const sellMode = document.getElementById('sellMode');
  const baseMode = document.getElementById('baseMode');
  const finalLabel = document.getElementById('finalLabel');

  // 切换计算模式
  modeBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      modeBtns.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      
      if (this.dataset.mode === 'sell') {
        sellMode.classList.add('active');
        baseMode.classList.remove('active');
        finalLabel.textContent = '最终卖价:';
    } else {
        baseMode.classList.add('active');
        sellMode.classList.remove('active');
        finalLabel.textContent = '实收底价:';
      }
    });
  });

    // 格式化金额显示
    const formatPrice = (num) => {
      return '¥' + num.toFixed(2);
    };

  // 计算卖价
  document.getElementById('calculateSell').addEventListener('click', function() {
    const basePrice = parseFloat(document.getElementById('basePrice').value) || 0;
    const commission = parseFloat(document.getElementById('commission').value) || 0;
    const activityDiscount = parseFloat(document.getElementById('activityDiscount').value) || 0;
    const promoDiscount = parseFloat(document.getElementById('promoDiscount').value) || 0;
    const coupon = parseFloat(document.getElementById('coupon').value) || 0;

    // 计算总折扣率
    const totalDiscountRate = (commission + activityDiscount + promoDiscount) / 100;
    
    // 计算卖价: 底价 / (1 - 总折扣率)
    const sellPrice = basePrice / (1 - totalDiscountRate);
    
    // 计算各项金额
    const commissionAmount = sellPrice * (commission / 100);
    const activityAmount = sellPrice * (activityDiscount / 100);
    const promoAmount = sellPrice * (promoDiscount / 100);
    const totalFees = commissionAmount + activityAmount + promoAmount + coupon;

    // 更新显示结果
    document.getElementById('commissionAmount').textContent = formatPrice(commissionAmount);
    document.getElementById('activityAmount').textContent = formatPrice(activityAmount);
    document.getElementById('promoAmount').textContent = formatPrice(promoAmount);
    document.getElementById('couponAmount').textContent = formatPrice(coupon);
    document.getElementById('totalFees').textContent = formatPrice(totalFees);
    document.getElementById('finalPrice').textContent = formatPrice(sellPrice);
  });

  // 计算底价
  document.getElementById('calculateBase').addEventListener('click', function() {
    const sellPrice = parseFloat(document.getElementById('sellPrice').value) || 0;
    const commission = parseFloat(document.getElementById('commissionBase').value) || 0;
    const activityDiscount = parseFloat(document.getElementById('activityDiscountBase').value) || 0;
    const promoDiscount = parseFloat(document.getElementById('promoDiscountBase').value) || 0;
    const coupon = parseFloat(document.getElementById('couponBase').value) || 0;

    // 计算各项金额
    const commissionAmount = sellPrice * (commission / 100);
    const activityAmount = sellPrice * (activityDiscount / 100);
    const promoAmount = sellPrice * (promoDiscount / 100);
    const totalFees = commissionAmount + activityAmount + promoAmount + coupon;

    // 计算底价: 卖价 - 总费用
    const basePrice = sellPrice - totalFees;

    // 更新显示结果
    document.getElementById('commissionAmount').textContent = formatPrice(commissionAmount);
    document.getElementById('activityAmount').textContent = formatPrice(activityAmount);
    document.getElementById('promoAmount').textContent = formatPrice(promoAmount);
    document.getElementById('couponAmount').textContent = formatPrice(coupon);
    document.getElementById('totalFees').textContent = formatPrice(totalFees);
    document.getElementById('finalPrice').textContent = formatPrice(basePrice);
  });

  // 输入框回车触发计算
  const sellInputs = ['basePrice', 'commission', 'activityDiscount', 'promoDiscount', 'coupon'];
  const baseInputs = ['sellPrice', 'commissionBase', 'activityDiscountBase', 'promoDiscountBase', 'couponBase'];

  sellInputs.forEach(id => {
    document.getElementById(id)?.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        document.getElementById('calculateSell').click();
      }
    });
  });

  baseInputs.forEach(id => {
    document.getElementById(id)?.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        document.getElementById('calculateBase').click();
      }
    });
  });
}); 