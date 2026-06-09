/**
 * 视图层：分析页 - 历史列表标签页
 * 职责：渲染最新开奖、历史列表、倒计时、加载更多按钮
 * 依赖方向：被 business/ 调用，仅做 DOM 渲染
 * 拆分记录：2026-06-09 从 view-analysis.js 拆分
 */
const ViewAnalysisHistory = {

  /**
   * 渲染最新开奖（接收预处理的显示数据）
   */
  renderLatest: function(displayData) {
    if(!displayData) return;
    var latestBalls = document.getElementById('latestBalls');
    var curExpect = document.getElementById('curExpect');
    if(latestBalls && displayData.ballsHtml !== undefined) latestBalls.innerHTML = displayData.ballsHtml;
    if(curExpect && displayData.expect !== undefined) curExpect.innerText = displayData.expect || '--';
  },

  /**
   * 渲染历史列表（接收预处理的历史HTML和行HTML）
   */
  renderHistory: function(historyData) {
    var historyList = document.getElementById('historyList');
    if(!historyList) return;
    if(historyData.isEmpty) {
      historyList.innerHTML = '<div style="padding:20px;text-align:center;">暂无历史数据</div>';
    } else {
      historyList.innerHTML = historyData.historyHtml;
    }
    var loadMore = document.getElementById('loadMore');
    if(loadMore) {
      loadMore.style.display = historyData.loadMoreVisible ? 'block' : 'none';
    }
  },

  showHistoryLoading: function() {
    var historyList = document.getElementById('historyList');
    if(historyList) historyList.innerHTML = '<div style="padding:20px;text-align:center;">加载中...</div>';
  },

  showHistoryError: function() {
    var historyList = document.getElementById('historyList');
    if(historyList) {
      historyList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--danger);">数据加载失败，请刷新重试</div>';
    }
  },

  /**
   * 更新加载更多按钮可见性
   */
  updateLoadMoreBtn: function(visible) {
    var loadMore = document.getElementById('loadMore');
    if(loadMore) loadMore.style.display = visible ? 'block' : 'none';
  },

  /**
   * 更新倒计时显示
   */
  updateCountdown: function(timeStr) {
    var countdown = document.getElementById('countdown');
    if(countdown) countdown.innerText = timeStr;
  }

};

// 挂载到 ViewAnalysis 以保持外部 API 兼容
if (typeof ViewAnalysis !== 'undefined') {
  ViewAnalysis.renderLatest = ViewAnalysisHistory.renderLatest;
  ViewAnalysis.renderHistory = ViewAnalysisHistory.renderHistory;
  ViewAnalysis.showHistoryLoading = ViewAnalysisHistory.showHistoryLoading;
  ViewAnalysis.showHistoryError = ViewAnalysisHistory.showHistoryError;
  ViewAnalysis.updateLoadMoreBtn = ViewAnalysisHistory.updateLoadMoreBtn;
  ViewAnalysis.updateCountdown = ViewAnalysisHistory.updateCountdown;
}
