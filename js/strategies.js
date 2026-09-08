/* ==========================================================================
   Strategies automatiques de pilotage de la batterie.
   ========================================================================== */
(function (global) {
  'use strict';

  function applyDispatchStrategy(hourlyData, params, strategy) {
    var pBattMax = params.batteryPowerKw;

    return hourlyData.map(function (pt) {
      var pvGen = pt.pvNormKwPerKwc * params.pvInstalledKwc;
      var netBalance = pvGen - pt.loadKw; // >0 surplus solaire, <0 deficit
      var cmd = 0;

      if (strategy === 'self_consumption') {
        // Charge sur le surplus, decharge sur le deficit
        if (netBalance > 0) {
          cmd = Math.min(pBattMax, netBalance);
        } else if (netBalance < 0) {
          cmd = -Math.min(pBattMax, Math.abs(netBalance));
        }
      } else if (strategy === 'peak_shaving') {
        // Ecrete les pointes qui approchent la limite de raccordement
        var peakThreshold = params.gridMaxPowerKw * 0.75;
        var requiredFromGrid = pt.loadKw - pvGen;
        if (requiredFromGrid > peakThreshold) {
          cmd = -Math.min(pBattMax, requiredFromGrid - peakThreshold);
        } else if (netBalance > 0) {
          cmd = Math.min(pBattMax, netBalance);
        } else if (pt.hour >= 1 && pt.hour <= 5 && requiredFromGrid < peakThreshold * 0.5) {
          // Recharge lente de nuit
          cmd = Math.min(pBattMax * 0.5, peakThreshold - requiredFromGrid);
        }
      } else if (strategy === 'spot_arbitrage') {
        // Charge aux heures creuses, decharge aux heures cheres
        var price = pt.spotPriceEurPerMwh;
        if (price <= 60 || netBalance > 10) {
          cmd = Math.min(pBattMax, Math.max(netBalance, pBattMax * 0.8));
        } else if (price >= 115 || (price >= 90 && netBalance < -10)) {
          cmd = -Math.min(pBattMax, Math.abs(netBalance > 0 ? 0 : netBalance) + 15);
        }
      } else if (strategy === 'zero_injection') {
        // Ne charge que sur surplus solaire, n'injecte jamais
        if (netBalance > 0) {
          cmd = Math.min(pBattMax, netBalance);
        }
      }
      // 'reset' laisse cmd a 0

      cmd = Math.round(cmd * 10) / 10;

      return Object.assign({}, pt, { batteryDispatchCmdKw: cmd });
    });
  }

  global.MGStrategies = { applyDispatchStrategy: applyDispatchStrategy };
})(window);
