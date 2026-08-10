var VConsoleInit = pc.createScript('vConsoleInit');

VConsoleInit.prototype.initialize = function() {
    // 檢查 vConsole 兵器是否已就緒，並在畫面上召喚它
    if (typeof window.VConsole !== 'undefined') {
        this.vConsole = new window.VConsole();
        console.log("[視察官] vConsole 面板已啟動！隨時為主公監控戰場！");
    } else {
        console.error("[視察官] 召喚失敗，請檢查 External Scripts 的網址是否正確。");
    }
};

VConsoleInit.prototype.destroy = function() {
    // 遊戲關閉時讓視察官退下
    if (this.vConsole) {
        this.vConsole.destroy();
    }
};