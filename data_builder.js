/* BBL Data Builder
 * BBLAnalysis 출력 + Fitness CSV 파싱 결과를 Report 7의 `BBL_PITCHERS` 형식으로 변환.
 *
 * 입력:
 *   - profile: { id, name, age, heightCm, weightKg, throwingHand }
 *   - velocity: { max, avg }
 *   - bio: BBLAnalysis.analyze() 출력
 *   - physical: BBLFitness.parseFitnessCSV().physical 또는 manual 입력 결과
 *
 * 출력: Report 7의 단일 pitcher 객체 (window.BBL_PITCHERS 배열 항목과 동일 형식)
 *
 * Exposes: window.BBLDataBuilder = { build }
 */
(function () {
  'use strict';

  // 참조값 (Report 7 data.js와 동일)
  // ─────────────────────────────────────────────────────────────
  // Reference baseline (한국 대학생/고교생 우수 투수 기준)
  // 출처: Aguinaldo 2015 (high school college level), Fleisig 1999, Naito 2014
  // 주: MLB elite는 pelvis 600+/trunk 950+/arm 1900+이지만,
  //     한국 고교/대학 우수 투수는 더 낮은 분포에 있어 baseline을 낮춤.
  //     현재 시스템은 한국 학생 투수 분석용이므로 이 기준을 사용.
  // ─────────────────────────────────────────────────────────────
  const REF = {
    pelvis:  { low: 500, high: 600 },   // 한국 우수 고1: 500-600 °/s
    trunk:   { low: 750, high: 900 },   // 한국 우수 고1: 750-900 °/s
    arm:     { low: 1350, high: 1550 }, // 한국 우수 고1: 1350-1550 °/s
    layback: { low: 160, high: 180 },
    etiTA:   { leakBelow: 0.85, ideal: 1.0 },
  };

  function bandFromRange(value, low, high) {
    if (value == null || isNaN(value)) return 'na';
    if (value >= high) return 'high';
    if (value >= low) return 'mid';
    return 'low';
  }

  function r1(v) { return v == null ? null : Math.round(v * 10) / 10; }
  function r2(v) { return v == null ? null : Math.round(v * 100) / 100; }
  function r0(v) { return v == null ? null : Math.round(v); }
  function safeFn(fn, dflt) { try { return fn(); } catch(e) { return dflt; } }

  // ═════════════════════════════════════════════════════════════════
  // 시퀀싱 코멘트 생성
  // ═════════════════════════════════════════════════════════════════
  function buildSequenceComment(ptLag, taLag, ptCv, taCv) {
    const parts = [];
    if (ptLag != null) {
      const ok = ptLag >= 25 && ptLag <= 70;
      parts.push(`P→T lag ${r0(ptLag)}ms${ok ? ' 정상' : (ptLag < 25 ? ' 짧음' : ' 김')}`);
    }
    if (taLag != null) {
      const ok = taLag >= 25 && taLag <= 70;
      parts.push(`T→A lag ${r0(taLag)}ms${ok ? ' 정상' : (taLag < 25 ? ' 짧음' : ' 김')}`);
    }
    if (ptCv != null && ptCv < 15) parts.push('일관성 우수');
    else if (ptCv != null && ptCv > 30) parts.push('타이밍 변동 큼');
    return parts.length ? '· ' + parts.join(' · ') : '— 데이터 부족';
  }

  // ═════════════════════════════════════════════════════════════════
  // 회전 속도 코멘트
  // ═════════════════════════════════════════════════════════════════
  function buildAngularComment(pelvis, trunk, arm) {
    const parts = [];
    if (pelvis != null) parts.push(`pelvis ${r0(pelvis)}`);
    if (trunk  != null) parts.push(`trunk ${r0(trunk)}`);
    if (arm    != null) parts.push(`arm ${r0(arm)} °/s`);
    return parts.length ? '· ' + parts.join(' → ') : '— 데이터 부족';
  }

  // ═════════════════════════════════════════════════════════════════
  // 에너지 코멘트
  // ═════════════════════════════════════════════════════════════════
  function buildEnergyComment(etiPT, etiTA, leakPct) {
    const parts = [];
    if (etiTA != null) parts.push(`ETI T→A ${r2(etiTA)}`);
    if (etiPT != null) parts.push(`ETI P→T ${r2(etiPT)}`);
    if (leakPct != null) {
      if (leakPct === 0) parts.push('누수 0%');
      else if (leakPct > 0) parts.push(`약 ${r0(leakPct)}% 손실`);
    }
    return parts.length ? '· ' + parts.join(' · ') : '— 데이터 부족';
  }

  // ═════════════════════════════════════════════════════════════════
  // Layback 코멘트
  // ═════════════════════════════════════════════════════════════════
  function buildLaybackComment(deg, band, sd) {
    if (deg == null) return '— 측정 불가';
    const parts = [`${r1(deg)}°`];
    if (band === 'high') parts.push('가속 거리 충분');
    else if (band === 'low') parts.push('가속 거리 부족');
    if (sd != null) parts.push(`SD ±${r1(sd)}°`);
    return '· ' + parts.join(' · ');
  }

  // ═════════════════════════════════════════════════════════════════
  // Archetype + Severity + CoreIssue 자동 분류
  // ═════════════════════════════════════════════════════════════════
  // ⭐ v23 — 학술 근거 기반 archetype 분류
  //   분류 축:
  //   1. 절대 파워 (peakPowerArm + CMJ 절대값) — 학술적으로 가장 강한 신호
  //   2. 키네틱 체인 효율 (ETI 평균 ≥ 1.5 = 효율, < 1.0 = 누수)
  //   3. 체격 (체중 + BMI)
  //   인자 확장: kineticChain, precision
  function classifyArchetype(physical, summary, energy, kineticChain, precision) {
    const mass = physical.weightKg;
    const heightCm = physical.heightCm;
    const cmjAbs = physical.cmjPower?.cmjAbs;
    const imtpAbs = physical.maxStrength?.abs;
    const peakArmW = kineticChain?.peakPowerArm;
    const etiPT = summary.etiPT?.mean;
    const etiTA = summary.etiTA?.mean;
    const etiAvg = (etiPT != null && etiTA != null) ? (etiPT + etiTA) / 2 : null;
    const cockPwr = precision?.cockPowerWPerKg;

    // 절대 파워 등급 분류
    //   high: peakPowerArm ≥ 3500W AND (CMJ ≥ 3700W OR IMTP ≥ 2300N)
    //   mid:  peakPowerArm ≥ 2200W
    //   low:  그 외
    let powerLevel = 'low';
    if (peakArmW != null) {
      if (peakArmW >= 3500 && ((cmjAbs != null && cmjAbs >= 3700) || (imtpAbs != null && imtpAbs >= 2300))) {
        powerLevel = 'high';
      } else if (peakArmW >= 2200) {
        powerLevel = 'mid';
      }
    } else if (cmjAbs != null) {
      if (cmjAbs >= 3700) powerLevel = 'high';
      else if (cmjAbs >= 2800) powerLevel = 'mid';
    }

    // 키네틱 체인 효율 등급
    //   efficient: ETI 평균 ≥ 1.5 (Aguinaldo 2019)
    //   leaky:     ETI 어느 한 단계 < 1.0
    //   moderate:  그 외
    let chainLevel = 'moderate';
    if (etiAvg != null && etiAvg >= 1.5 && (etiPT >= 1.2 || etiTA >= 1.2)) chainLevel = 'efficient';
    else if ((etiPT != null && etiPT < 1.0) || (etiTA != null && etiTA < 1.0)) chainLevel = 'leaky';

    // 체격 등급 (Werner 2008: body mass + 9 params = 68% variance)
    const small = mass != null && mass < 70;
    const tall  = heightCm != null && heightCm >= 180;

    // 분류 결정
    // 1) 체격·절대 파워 모두 부족 → "체격·근육량 발달형"
    if (powerLevel === 'low' && small) {
      return { archetype: '체격·근육량 발달형',
               archetypeEn: 'Body-mass · power development needed' };
    }
    // 2) 절대 파워 부족 → "절대 파워 발달형"
    if (powerLevel === 'low') {
      return { archetype: '절대 파워 발달형',
               archetypeEn: 'Absolute power development needed' };
    }
    // 3) 키네틱 체인 누수 → "키네틱 체인 누수형"
    if (chainLevel === 'leaky') {
      return { archetype: '키네틱 체인 누수형',
               archetypeEn: 'Kinetic-chain leakage' };
    }
    // 4) 절대 파워 mid + 효율 양호 → "효율 우위형"
    if (powerLevel === 'mid' && chainLevel === 'efficient') {
      return { archetype: '효율 우위형 (체격 발달 여지)',
               archetypeEn: 'Efficiency-led · room for mass gain' };
    }
    // 5) 절대 파워 high + 효율 양호 → "엘리트 균형형"
    if (powerLevel === 'high' && chainLevel === 'efficient') {
      return { archetype: '엘리트 균형형 (파워+효율 우수)',
               archetypeEn: 'Elite balanced (power + efficiency)' };
    }
    // 6) 절대 파워 high + 효율 보통 → "파워 우위형"
    if (powerLevel === 'high') {
      return { archetype: '파워 우위형 (효율 다듬기 가능)',
               archetypeEn: 'Power-dominant · efficiency tunable' };
    }
    // 7) 기본
    return { archetype: '균형 발달형', archetypeEn: 'Balanced developing' };
  }

  // ⭐ v23 학술 근거 기반 약점 판정
  //   - 절대 KE/Power 부족 (peakPowerArm, KE_arm, cockPowerWPerKg)
  //   - 키네틱 체인 누수 (ETI < 1.5 = 누수, ETI < 1.0 = 명확 누수)
  //   - 절대 근력/파워 부족 (CMJ 절대값 W, IMTP 절대값 N)
  //   - 핵심 메카닉 미달 (Trunk forward tilt, Lead knee extension)
  //   인자 확장: kineticChain, precision 받음
  function classifyCoreIssue(physical, summary, energy, command, kineticChain, precision) {
    const issues = [];
    let severity = 'NONE';

    const etiPT = summary.etiPT?.mean;
    const etiTA = summary.etiTA?.mean;
    const leakPct = energy?.leakPct;
    const mass = physical.weightKg;

    // ━━ 키네틱 체인 누수 (사용자 강조 — 가장 핵심) ━━
    // ETI < 1.0 = 명확 누수 (HIGH)
    if (etiPT != null && etiPT < 1.0) {
      issues.push({ type: 'mech', severity: 'HIGH', label: '골반→몸통 에너지 명확 누수 (ETI<1.0)' });
      severity = 'HIGH';
    } else if (etiPT != null && etiPT < 1.3) {
      issues.push({ type: 'mech', severity: 'MEDIUM', label: '골반→몸통 에너지 부분 누수' });
      if (severity !== 'HIGH') severity = 'MEDIUM';
    }
    if (etiTA != null && etiTA < 1.0) {
      issues.push({ type: 'mech', severity: 'HIGH', label: '몸통→상완 에너지 명확 누수 (ETI<1.0)' });
      severity = 'HIGH';
    } else if (etiTA != null && etiTA < 1.3) {
      issues.push({ type: 'mech', severity: 'MEDIUM', label: '몸통→상완 에너지 부분 누수' });
      if (severity !== 'HIGH') severity = 'MEDIUM';
    }
    // 누수율 % 자체가 높으면
    if (leakPct != null && leakPct > 30) {
      issues.push({ type: 'mech', severity: 'HIGH', label: `에너지 누수율 ${leakPct.toFixed(0)}% (단계간 손실 과다)` });
      severity = 'HIGH';
    }

    // ━━ 절대 KE/Power 부족 (학술적 핵심 신호) ━━
    // peakPowerArm: 한국 baseline 1500=낮음, 3000=평균 → 1800W 미만이면 절대 부족
    if (kineticChain?.peakPowerArm != null && kineticChain.peakPowerArm < 1800) {
      issues.push({ type: 'mech', severity: 'HIGH', label: `Peak Power Arm 절대값 부족 (${kineticChain.peakPowerArm.toFixed(0)}W)` });
      severity = 'HIGH';
    }
    // cockPowerWPerKg: Naito 2014 기준, 25 미만 = 발달 필요
    if (precision?.cockPowerWPerKg != null && precision.cockPowerWPerKg < 25) {
      issues.push({ type: 'mech', severity: 'MEDIUM',
        label: `Cocking phase 팔 파워 부족 (${precision.cockPowerWPerKg.toFixed(1)} W/kg)` });
      if (severity !== 'HIGH') severity = 'MEDIUM';
    }

    // ━━ 절대 근력/파워 부족 (Sakurai 2024) ━━
    // CMJ 절대값 < 3000W = 하체 절대 폭발력 부족
    if (physical.cmjPower?.cmjAbs != null && physical.cmjPower.cmjAbs < 3000) {
      issues.push({ type: 'phys', severity: 'MEDIUM',
        label: `CMJ 절대 파워 부족 (${physical.cmjPower.cmjAbs}W)` });
      if (severity !== 'HIGH') severity = 'MEDIUM';
    }
    // IMTP 절대값 < 2000N = 절대 근력 부족
    if (physical.maxStrength?.abs != null && physical.maxStrength.abs < 2000) {
      issues.push({ type: 'phys', severity: 'MEDIUM',
        label: `IMTP 절대 근력 부족 (${physical.maxStrength.abs}N)` });
      if (severity !== 'HIGH') severity = 'MEDIUM';
    }
    // 체격 미달 — 체중 < 70 AND 절대 파워/근력 미달
    const cmjLow = physical.cmjPower?.cmjAbs != null && physical.cmjPower.cmjAbs < 3200;
    const strLow = physical.maxStrength?.abs != null && physical.maxStrength.abs < 2100;
    if (mass != null && mass < 70 && (cmjLow || strLow)) {
      issues.push({ type: 'phys', severity: 'MEDIUM',
        label: `체격·근육량 발달 필요 (${mass.toFixed(1)}kg + 절대 파워 부족)` });
      if (severity !== 'HIGH') severity = 'MEDIUM';
    }

    // ━━ 핵심 메카닉 미달 ━━
    // Trunk peak angular velocity < 700°/s = 몸통 회전 부족
    if (summary.peakTrunkVel?.mean != null && summary.peakTrunkVel.mean < 700) {
      issues.push({ type: 'mech', severity: 'MEDIUM',
        label: `몸통 회전 속도 부족 (${summary.peakTrunkVel.mean.toFixed(0)}°/s)` });
      if (severity !== 'HIGH') severity = 'MEDIUM';
    }

    // ━━ 드라이브라인 핵심 변인 미달 ━━
    // Layback (MER) < 160° = 어깨 외회전 가동성 부족 (드라이브라인 0.86)
    if (summary.maxER?.mean != null && summary.maxER.mean < 160) {
      issues.push({ type: 'mech', severity: 'MEDIUM',
        label: `Layback 부족 (${summary.maxER.mean.toFixed(0)}°)` });
      if (severity !== 'HIGH') severity = 'MEDIUM';
    }
    // CoG Decel < 1.2 m/s = 무게중심 감속 부족 (드라이브라인 0.70)
    if (summary.cogDecel?.mean != null && summary.cogDecel.mean < 1.2) {
      issues.push({ type: 'mech', severity: 'MEDIUM',
        label: `CoG 감속 부족 (${summary.cogDecel.mean.toFixed(2)}m/s · 엘리트 1.61)` });
      if (severity !== 'HIGH') severity = 'MEDIUM';
    }
    // Lead Knee Extension < 0° = 앞다리 신전 부족 (드라이브라인 0.58)
    if (summary.leadKneeExtAtBR?.mean != null && summary.leadKneeExtAtBR.mean < 0) {
      issues.push({ type: 'mech', severity: 'MEDIUM',
        label: `앞다리 신전 부족 (${summary.leadKneeExtAtBR.mean.toFixed(0)}° · 엘리트 11°)` });
      if (severity !== 'HIGH') severity = 'MEDIUM';
    }
    // Stride ratio < 0.75 = 스트라이드 짧음 (드라이브라인 0.58)
    if (summary.strideRatio?.mean != null && summary.strideRatio.mean < 0.75) {
      issues.push({ type: 'mech', severity: 'MEDIUM',
        label: `스트라이드 짧음 (${(summary.strideRatio.mean*100).toFixed(0)}% · 엘리트 83-87%)` });
      if (severity !== 'HIGH') severity = 'MEDIUM';
    }

    // 제구 등급 D
    if (command?.overall === 'D') {
      issues.push({ type: 'cmd', severity: 'MEDIUM', label: '제구 일관성 부족' });
      if (severity !== 'HIGH') severity = 'MEDIUM';
    }

    // ⭐ v26 — 제구 4그룹 핵심 변인 약점 판정
    // [A] 앞발 착지 — Manzi 2021 #2 (4.2% MSE)
    const kneeFcSd = summary.kneeFlexionAtFC?.sd ?? summary.frontKneeFlex?.sd;
    if (kneeFcSd != null && kneeFcSd > 8) {
      issues.push({ type: 'cmd', severity: 'MEDIUM',
        label: `FC 무릎 굴곡 변동 큼 (${kneeFcSd.toFixed(1)}° SD · Manzi 2021 정확도 #2 예측)` });
      if (severity !== 'HIGH') severity = 'MEDIUM';
    }
    if (summary.leadKneeExtAtBR?.sd != null && summary.leadKneeExtAtBR.sd > 8) {
      issues.push({ type: 'cmd', severity: 'MEDIUM',
        label: `FC→BR 무릎 신전 일관성 부족 (${summary.leadKneeExtAtBR.sd.toFixed(1)}° SD)` });
      if (severity !== 'HIGH') severity = 'MEDIUM';
    }
    if (summary.strideLength?.cv != null && summary.strideLength.cv > 8) {
      issues.push({ type: 'cmd', severity: 'MEDIUM',
        label: `스트라이드 길이 변동 큼 (${summary.strideLength.cv.toFixed(1)}% CV · Drives/Fleisig 청소년 핵심 차이)` });
      if (severity !== 'HIGH') severity = 'MEDIUM';
    }
    // [B] 회전 타이밍 — Wang 2025 r=−0.78
    if (summary.peakPelvisVel?.cv != null && summary.peakPelvisVel.cv > 15) {
      issues.push({ type: 'cmd', severity: 'MEDIUM',
        label: `골반 회전속도 변동 큼 (${summary.peakPelvisVel.cv.toFixed(1)}% CV · Wang 2025 r=−0.78)` });
      if (severity !== 'HIGH') severity = 'MEDIUM';
    }
    // [C] 자세 일관성 — Manzi 2021 #1 (6.6% MSE)
    const trunkFcSd = summary.trunkForwardTiltAtFC?.sd ?? summary.trunkFlexAtFC?.sd;
    if (trunkFcSd != null && trunkFcSd > 6) {
      issues.push({ type: 'cmd', severity: 'MEDIUM',
        label: `FC 몸통 자세 변동 큼 (${trunkFcSd.toFixed(1)}° SD · Manzi 2021 정확도 #1 예측)` });
      if (severity !== 'HIGH') severity = 'MEDIUM';
    }

    if (issues.length === 0) {
      return {
        coreIssue: '· 모든 구간 기준 충족 · 뚜렷한 약점 없음',
        coreIssueEn: 'No bottleneck — maintain current balance',
        severity: 'NONE'
      };
    }

    return {
      coreIssue: '· ' + issues.slice(0, 4).map(i => i.label).join(' · '),
      coreIssueEn: issues.slice(0, 4).map(i => i.label).join(' + '),
      severity
    };
  }

  // ═════════════════════════════════════════════════════════════════
  // Tags (reactive+ / reactive- 등)
  // ═════════════════════════════════════════════════════════════════
  function buildTags(physical) {
    const tags = [];
    if (physical.reactive?.band === 'high') tags.push('reactive+');
    else if (physical.reactive?.band === 'low') tags.push('reactive-');
    if (physical.cmjPower?.band === 'high') tags.push('power+');
    else if (physical.cmjPower?.band === 'low') tags.push('power-');
    return tags;
  }

  // ═════════════════════════════════════════════════════════════════
  // Radar 데이터 (5+1 = 6개 축) — Report 7의 6개 축과 호환
  // ═════════════════════════════════════════════════════════════════
  function buildRadar(physical) {
    return [
      { key: 'cmj',   label: '폭발력',     sub: '하체 폭발력',
        value: physical.cmjPower?.cmj, display: physical.cmjPower?.cmj != null ? `${physical.cmjPower.cmj}` : 'N/A',
        lo: 40, hi: 50 },
      { key: 'sj',    label: '순수파워',   sub: '정지→폭발',
        value: physical.cmjPower?.sj, display: physical.cmjPower?.sj != null ? `${physical.cmjPower.sj}` : 'N/A',
        lo: 38, hi: 50 },
      { key: 'str',   label: '버티는 힘',  sub: '최대 근력',
        value: physical.maxStrength?.perKg, display: physical.maxStrength?.perKg != null ? `${physical.maxStrength.perKg}` : 'N/A',
        lo: 25, hi: 35 },
      { key: 'rsi',   label: '빠른 반동',  sub: '순간 반응',
        value: physical.reactive?.cmj, display: physical.reactive?.cmj != null ? `${physical.reactive.cmj}` : 'N/A',
        lo: 0.30, hi: 0.55 },
      { key: 'eur',   label: '반동 활용',  sub: '탄성 에너지',
        value: physical.ssc?.value, display: physical.ssc?.value != null ? `${physical.ssc.value}` : 'N/A',
        lo: 0.95, hi: 1.10 },
      { key: 'grip',  label: '손목 힘',    sub: '릴리스 안정',
        value: physical.release?.value, display: physical.release?.value != null ? `${physical.release.value}` : 'N/A',
        lo: 50, hi: 65 }
    ];
  }

  // ═════════════════════════════════════════════════════════════════
  // 7대 요인 (BBLAnalysis.factors → Report 7 factors 형식)
  // ═════════════════════════════════════════════════════════════════
  function buildFactors(bioFactors, summary, faultRates) {
    if (!Array.isArray(bioFactors)) return [];

    const sm = summary || {};
    const fr = faultRates || {};

    const lookup = {
      F1: {
        id: 'F1_landing', name: '① 앞발 착지',
        measured: {
          stride_m: r2(sm.strideLength?.mean),
          stride_cv: r1(sm.strideLength?.cv),
          knee_flex_deg: r1(sm.frontKneeFlex?.mean),
          knee_sd: r1(sm.frontKneeFlex?.sd)
        },
        elite: 'stride CV 2-3% · knee 25-40° · SD 3-5°'
      },
      F2: {
        id: 'F2_separation', name: '② 골반-몸통 분리',
        measured: {
          max_sep_deg: r1(sm.maxXFactor?.mean),
          sep_sd: r1(sm.maxXFactor?.sd),
          sep_lag_ms: r0(sm.ptLagMs?.mean),
          lag_sd: r1(sm.ptLagMs?.sd)
        },
        elite: '40-60° · lag ~50ms · SD <10ms'
      },
      F3: {
        id: 'F3_arm_timing', name: '③ 어깨-팔 타이밍',
        measured: {
          mer_deg: r1(sm.maxER?.mean),
          mer_sd: r1(sm.maxER?.sd),
          fc_to_br_ms: r0(sm.fcBrMs?.mean),
          fcbr_sd: r1(sm.fcBrMs?.sd)
        },
        elite: 'MER ~180° · FC→BR ~150ms · SD <10ms'
      },
      F4: {
        id: 'F4_knee', name: '④ 앞 무릎 안정성',
        measured: {
          knee_fc_deg: r1(sm.frontKneeFlex?.mean),
          knee_sd: r1(sm.frontKneeFlex?.sd),
          blocking_deg: r1(sm.leadKneeExtAtBR?.mean),
          block_sd: r1(sm.leadKneeExtAtBR?.sd)
        },
        elite: '25-40° · blocking + (펴짐) · SD <5°'
      },
      F5: {
        id: 'F5_tilt', name: '⑤ 몸통 기울기',
        measured: {
          forward_deg: r1(sm.trunkForwardTilt?.mean),
          forward_sd: r1(sm.trunkForwardTilt?.sd),
          lateral_deg: r1(sm.trunkLateralTilt?.mean),
          lateral_sd: r1(sm.trunkLateralTilt?.sd)
        },
        elite: 'forward 30-40° · lateral 20-30° · SD 3-5°'
      },
      F6: {
        id: 'F6_head', name: '⑥ 머리·시선 안정성',
        measured: {
          head_disp_cm: '—',
          head_sd: '—',
          sway_pct: r1(fr.sway?.rate),
          getting_out_pct: r1(fr.gettingOut?.rate)
        },
        elite: 'sway 0% · 시선 고정'
      },
      F7: {
        id: 'F7_wrist', name: '⑦ 그립·손목 정렬',
        measured: {
          arm_slot_deg: r1(sm.armSlotAngle?.mean),
          arm_sd: r2(sm.armSlotAngle?.sd)
        },
        elite: 'arm_slot SD <3°'
      }
    };

    return bioFactors.map(f => {
      const meta = lookup[f.id] || { id: f.id, name: f.name, measured: {}, elite: '' };
      const m = meta.measured;
      // 코멘트 자동 생성
      const valStrs = [];
      Object.entries(m).forEach(([k, v]) => {
        if (v != null && v !== '—') {
          const niceKey = k.replace(/_(deg|m|ms|cv|sd|pct|cm)/g, '').replace(/_/g, ' ');
          if (k.includes('cv') || k.includes('pct')) valStrs.push(`${niceKey} ${v}%`);
          else if (k.includes('deg')) valStrs.push(`${niceKey} ${v}°`);
          else if (k.includes('ms')) valStrs.push(`${niceKey} ${v}ms`);
          else if (k.includes('sd')) valStrs.push(`SD ±${v}`);
          else valStrs.push(`${niceKey} ${v}`);
        }
      });
      return {
        id: meta.id,
        name: meta.name,
        grade: f.grade || 'N/A',
        measured: m,
        elite: meta.elite,
        comment: valStrs.length ? '· ' + valStrs.join(' · ') : '· 측정값 부족'
      };
    });
  }

  // ═════════════════════════════════════════════════════════════════
  // Command 데이터 변환 (BBLAnalysis.command → Report 7 command)
  // ═════════════════════════════════════════════════════════════════
  function buildCommand(bioCmd, sm) {
    if (!bioCmd) return null;
    const overall = bioCmd.overall || 'N/A';
    const domains = bioCmd.domains || [];

    // ─── Sequencing domain N/A fallback ───
    // ptLagMs/taLagMs의 CV가 산출 안 되면 (trial 1개 또는 분모 문제) sequencing이 N/A로 떨어짐.
    // 이때 raw mean 기반으로 등급을 부여 — files Howenstein 2019 / Naito 2014 timing window 사용.
    // P→T lag elite 25-65ms, T→A lag elite 15-45ms.
    function rawSequencingGrade(ptMean, taMean) {
      function gradeOne(v, lo, hi) {
        if (v == null || isNaN(v)) return null;
        if (v >= lo && v <= hi) return 4;     // A (elite range)
        const mid = (lo + hi) / 2;
        const range = (hi - lo) / 2;
        const off = Math.abs(v - mid);
        if (off <= range * 1.5) return 3;     // B
        if (off <= range * 2.5) return 2;     // C
        return 1;                              // D
      }
      const ptScore = gradeOne(ptMean, 25, 65);
      const taScore = gradeOne(taMean, 15, 45);
      const valid = [ptScore, taScore].filter(s => s != null);
      if (valid.length === 0) return null;
      const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
      const grade = avg >= 3.5 ? 'A' : avg >= 2.5 ? 'B' : avg >= 1.5 ? 'C' : 'D';
      return { grade, score: avg, ptScore, taScore };
    }

    // 도메인 중 sequencing이 N/A이면 raw mean으로 fallback
    const sequencingIdx = domains.findIndex(d => d.key === 'sequencing');
    if (sequencingIdx >= 0 && (domains[sequencingIdx].grade === 'N/A' || domains[sequencingIdx].grade == null)) {
      const fb = rawSequencingGrade(sm.ptLagMs?.mean, sm.taLagMs?.mean);
      if (fb) {
        domains[sequencingIdx] = {
          ...domains[sequencingIdx],
          grade: fb.grade,
          score: fb.score,
          fallback: true  // 표시용 플래그
        };
      }
    }

    // breakdown — 각 domain의 score를 음수로 (낮을수록 좋음)
    // Report 7은 wrist, armslot, trunkTilt, layback, stride, fcRelease 키 사용
    const domainByKey = Object.fromEntries(domains.map(d => [d.key, d]));
    const releasePos = domainByKey.releasePos;
    const sequencing = domainByKey.sequencing;
    const releaseTiming = domainByKey.releaseTiming;
    const footContact = domainByKey.footContact;
    const powerOutput = domainByKey.powerOutput;

    function neg(score) { return score == null ? 0 : -(5 - score); } // 4점→-1, 1점→-4

    const breakdown = {
      wrist: neg(releasePos?.subs?.find(s => s.name?.includes('손목'))?.score),
      armslot: neg(releasePos?.subs?.find(s => s.name?.includes('Arm slot') || s.name?.includes('arm slot'))?.score),
      trunkTilt: neg(releasePos?.subs?.find(s => s.name?.includes('몸통'))?.score),
      layback: neg(powerOutput?.subs?.find(s => s.name?.includes('Max ER'))?.score),
      stride: neg(footContact?.subs?.find(s => s.name?.includes('Stride'))?.score),
      fcRelease: neg(releaseTiming?.subs?.find(s => s.name?.includes('FC'))?.score)
    };

    // measured — 핵심 일관성 지표 raw 값
    const measured = {
      wristHeightSdCm: sm.wristHeight?.sd != null ? r2(sm.wristHeight.sd * 100) : null,
      armSlotSdDeg: r2(sm.armSlotAngle?.sd),
      trunkTiltSdDeg: r2(sm.trunkForwardTilt?.sd),
      laybackCvPct: r2(sm.maxER?.cv),
      strideCvPct: r2(sm.strideLength?.cv),
      fcReleaseMs: r0(sm.fcBrMs?.mean),
      fcReleaseCvPct: r1(sm.fcBrMs?.cv)
    };

    // strikePct, plateSdCm은 직접 측정 불가 — 추정값으로 대체 (Domain 등급 기반)
    const gradeToScore = { A: 4, B: 3, C: 2, D: 1 };
    const overallScore = gradeToScore[overall] || 0;
    const estStrikePct = overallScore === 4 ? 75 : overallScore === 3 ? 65 : overallScore === 2 ? 58 : overallScore === 1 ? 50 : null;
    const estPlateSd = overallScore === 4 ? 14 : overallScore === 3 ? 18 : overallScore === 2 ? 22 : overallScore === 1 ? 28 : null;

    // ─── 5 Domain Radar Data (files report.jsx toCommandRadarData 포팅) ───
    // 각 도메인 score(0~4)를 inverted 값(5-score)으로 변환 후 RadarChart에 전달
    // RadarChart는 lo=50, hi=80 기준, value < lo = 미흡, value > hi = 우수
    // domains의 grade를 0-100 점수로 변환: A→90, B→70, C→50, D→30, N/A→null
    const gradeRadarValue = { A: 90, B: 70, C: 50, D: 30, 'N/A': null };
    const radarData = domains.map(d => {
      // score 기반으로 더 정밀한 점수 계산
      let radarVal;
      if (d.score == null || d.score === 0) {
        radarVal = gradeRadarValue[d.grade] ?? null;
      } else {
        // score 0~4 범위를 30~95 점수로 매핑 (0→30, 4→95)
        radarVal = 30 + (d.score / 4) * 65;
      }
      return {
        label: d.name,
        sub: d.icon ? `${d.icon} ${d.grade || '—'}` : (d.desc || ''),
        value: radarVal,
        lo: 50, hi: 80,
        display: d.grade === 'N/A' ? '—' : d.grade
      };
    });

    // note — domain별 등급 요약
    const domainGrades = domains.map(d => d.grade).join('/');
    const validCount = domains.filter(d => d.grade && d.grade !== 'N/A' && d.grade !== 'D').length;
    const totalCount = domains.length;
    const note = `· 5개 Domain 종합: ${domainGrades} · ${validCount}/${totalCount} 양호`;

    return {
      strikePct: estStrikePct,
      plateSdCm: estPlateSd,
      grade: overall,
      breakdown,
      measured,
      note,
      isDemo: true,  // 추정값임을 표시
      nTrials: bioCmd.nUsedForCommand || 10,
      radarData,     // 5 Domain RadarChart용
      domains        // 원본 도메인 정보 (subs 포함)
    };
  }

  // ═════════════════════════════════════════════════════════════════
  // Sequence 데이터 (P→T→A 타이밍)
  // ═════════════════════════════════════════════════════════════════
  function buildSequence(sm, sequencing) {
    const ptLag = sm.ptLagMs?.mean;
    const taLag = sm.taLagMs?.mean;
    const ptCv = sm.ptLagMs?.cv;
    const taCv = sm.taLagMs?.cv;

    return {
      pelvisMs: 0,
      trunkMs: ptLag != null ? r0(ptLag) : null,
      armMs:   (ptLag != null && taLag != null) ? r0(ptLag + taLag) : null,
      g1: ptLag != null ? r0(ptLag) : null,
      g2: taLag != null ? r0(taLag) : null,
      comment: buildSequenceComment(ptLag, taLag, ptCv, taCv)
    };
  }

  // ═════════════════════════════════════════════════════════════════
  // Angular 데이터
  // ═════════════════════════════════════════════════════════════════
  function buildAngular(sm) {
    const pelvis = sm.peakPelvisVel?.mean;
    const trunk  = sm.peakTrunkVel?.mean;
    const arm    = sm.peakArmVel?.mean;
    const gainPT = (pelvis != null && trunk != null && pelvis > 0) ? trunk / pelvis : null;
    const gainTA = (trunk != null && arm != null && trunk > 0) ? arm / trunk : null;

    return {
      pelvis: r0(pelvis),
      trunk:  r0(trunk),
      arm:    r0(arm),
      pelvisBand: bandFromRange(pelvis, REF.pelvis.low, REF.pelvis.high),
      trunkBand:  bandFromRange(trunk,  REF.trunk.low,  REF.trunk.high),
      armBand:    bandFromRange(arm,    REF.arm.low,    REF.arm.high),
      gainPT: r2(gainPT) != null ? gainPT : 0,
      gainTA: r2(gainTA) != null ? gainTA : 0,
      comment: buildAngularComment(pelvis, trunk, arm)
    };
  }

  // ═════════════════════════════════════════════════════════════════
  // Energy 데이터
  // ═════════════════════════════════════════════════════════════════
  function buildEnergy(sm, energy) {
    const etiPT = sm.etiPT?.mean;
    const etiTA = sm.etiTA?.mean;
    const leakRate = energy?.leakRate;
    // ⭐ v21 — 누수율 계산 보강
    //   기존: etiTA < 0.85 만 누수로 인식 → 대부분 0% 동일하게 표시
    //   신규: P→T와 T→A 양쪽 단계의 효율 부족분을 합산
    //   이상적 키네틱 체인: 각 단계 ETI ≥ 1.5 (KE가 다음 분절로 1.5x 이상 증폭)
    //   ETI < 1.5는 그만큼 효율 손실로 간주
    function stageLeak(eti) {
      if (eti == null) return 0;
      const ideal = 1.5;
      if (eti >= ideal) return 0;             // 충분한 증폭 → 누수 없음
      // ETI 1.5에서 0%, 1.0에서 30%, 0.5에서 60%까지 선형
      return Math.max(0, Math.round((ideal - eti) * 60));
    }
    const ptLeak = stageLeak(etiPT);
    const taLeak = stageLeak(etiTA);
    const leakPct = Math.min(60, ptLeak + taLeak);  // 합산 (max 60%로 cap)
    return {
      etiPT: r2(etiPT) != null ? etiPT : 0,
      etiTA: r2(etiTA) != null ? etiTA : 0,
      leakPct: leakPct,
      ptLeak: ptLeak,    // 단계별 누수 (디버그/세부 분석용)
      taLeak: taLeak,
      comment: buildEnergyComment(etiPT, etiTA, leakPct)
    };
  }

  // ═════════════════════════════════════════════════════════════════
  // Precision 데이터 (5편 논문 정밀 지표 — IntegratedKineticDiagram용)
  //   - elbowEff:        Sabick 2004 elbow load efficiency
  //   - cockPowerWPerKg: Naito 2014 cocking phase arm power
  //   - transferTA_KE:   Aguinaldo & Escamilla 2019 trunk → arm KE transfer
  //   - legAsymmetry:    Crotin et al. 2014 stride/pivot leg symmetry
  //   - peakPivotHipVel / peakStrideHipVel:  pivot vs stride hip joint vel
  // ═════════════════════════════════════════════════════════════════
  function buildPrecision(sm) {
    // 무릎 무너짐 = FC→BR 굴곡 변화량
    const kneeCollapse = (sm.kneeFlexionAtFC?.mean != null && sm.kneeFlexionAtBR?.mean != null)
      ? r1(sm.kneeFlexionAtFC.mean - sm.kneeFlexionAtBR.mean)  // 양수=무너짐
      : null;
    // SSC: 우리 시스템에서 직접 계산되지 않으면 null (RSI-mod 등으로 추정 가능)
    return {
      elbowEff:         sm.elbowLoadEfficiency?.mean ?? null,
      cockPowerWPerKg:  sm.cockingPhaseArmPowerWPerKg?.mean ?? null,
      transferTA_KE:    sm.transferTA_KE?.mean ?? null,
      legAsymmetry:     sm.legAsymmetryRatio?.mean ?? null,
      peakPivotHipVel:  sm.peakPivotHipVel?.mean ?? null,
      peakStrideHipVel: sm.peakStrideHipVel?.mean ?? null,
      // ⭐ v8 — 신규 (마네킹 카드 표시용)
      kneeCollapseDeg:  kneeCollapse,                              // 무릎 무너짐 (양수=무너짐)
      kneeSscMs:        sm.kneeSscDurationMs?.mean ?? null,        // SSC 전환 시간
      flyingOpenDeg:    sm.trunkRotAtFP?.mean ?? null,             // 플라잉오픈 (FC 시점 trunk 회전)
      trunkFlexAtBRDeg: sm.trunkForwardTilt?.mean != null
                          ? Math.abs(sm.trunkForwardTilt.mean)
                          : null,                                   // 릴리즈 시 몸통 굴곡
      // ⭐ v10 — FC 시점 몸통 전방 굴곡 (부호 보존: 앞=+, 뒤=−)
      // 직립(0°) 또는 약간 뒤로 젖힌 상태(음수)가 이상적
      trunkFlexAtFCDeg: sm.trunkForwardTiltAtFC?.mean ?? null
    };
  }

  // ═════════════════════════════════════════════════════════════════
  // Kinetic Chain 데이터 (Section 05 — 분절 KE/Power/Transfer/Elbow)
  // files report.jsx Section 5 데이터 매핑
  // ═════════════════════════════════════════════════════════════════
  function buildKineticChain(sm) {
    function statusKE_PT(v) {
      if (v == null) return { tone: 'na', text: '—' };
      if (v >= 5)   return { tone: 'good', text: '강한 증폭' };
      if (v >= 3)   return { tone: 'mid',  text: '정상 증폭' };
      if (v >= 1.5) return { tone: 'low',  text: '약한 증폭' };
      return { tone: 'bad', text: '미약' };
    }
    function statusKE_TA(v) {
      if (v == null) return { tone: 'na', text: '—' };
      if (v >= 2.5) return { tone: 'good', text: '강한 증폭' };
      if (v >= 1.7) return { tone: 'mid',  text: '정상 증폭' };
      if (v >= 1.0) return { tone: 'low',  text: '약한 증폭' };
      return { tone: 'bad', text: '에너지 손실' };
    }
    const pt_KE = sm.transferPT_KE?.mean;
    const ta_KE = sm.transferTA_KE?.mean;
    return {
      // 분절 회전 KE (Naito 2011, Ae 1992 — ½·I·ω²)
      KE_pelvis: { val: r1(sm.KE_pelvis?.mean), sd: r1(sm.KE_pelvis?.sd), total: r1(sm.KE_pelvis_total?.mean) },
      KE_trunk:  { val: r1(sm.KE_trunk?.mean),  sd: r1(sm.KE_trunk?.sd),  total: r1(sm.KE_trunk_total?.mean) },
      KE_arm:    { val: r1(sm.KE_arm?.mean),    sd: r1(sm.KE_arm?.sd),    total: r1(sm.KE_arm_total?.mean) },
      // Transfer ratios (회전 KE 비율 — 키네틱 체인 amplification)
      transferPT_KE: { val: r1(pt_KE), ...statusKE_PT(pt_KE) },
      transferTA_KE: { val: r1(ta_KE), ...statusKE_TA(ta_KE) },
      // Peak instantaneous power (dE/dt)
      peakPowerTrunk: r0(sm.peakPowerTrunk?.mean),
      peakPowerArm:   r0(sm.peakPowerArm?.mean),
      // Elbow inverse dynamics (Yanai 2023)
      elbowPeakTorqueNm: { val: r1(sm.elbowPeakTorqueNm?.mean), sd: r1(sm.elbowPeakTorqueNm?.sd) }
    };
  }

  // ═════════════════════════════════════════════════════════════════
  // Velocity Radar 데이터 (Section 06 — 5영역 종합)
  //   files report.jsx toVelocityRadarData 포팅
  //   5 axes: 팔 동작 / 하체 블록 / 자세 안정성 / 회전 동력 / ⭐ 키네틱 체인 효율
  //   각 축 0-100 점수 (50=엘리트 평균, 80=엘리트 상위)
  // ═════════════════════════════════════════════════════════════════
  function varToScore(value, eliteMedian, higherBetter, eliteLow, eliteHigh) {
    if (value == null || isNaN(value)) return null;
    if (eliteLow != null && eliteHigh != null) {
      const inRange = value >= eliteLow && value <= eliteHigh;
      if (inRange) {
        const distFromMedian = Math.abs(value - eliteMedian);
        const halfRange = Math.max(eliteMedian - eliteLow, eliteHigh - eliteMedian);
        return Math.min(80, 50 + (1 - distFromMedian / halfRange) * 30);
      }
      const overshoot = value < eliteLow ? (eliteLow - value) / Math.max(eliteLow, 1)
                                          : (value - eliteHigh) / Math.max(eliteHigh, 1);
      return Math.max(10, 50 - overshoot * 40);
    }
    if (higherBetter) {
      if (value <= 0) return 10;
      if (value <= eliteMedian) return Math.min(50, (value / eliteMedian) * 50);
      return Math.min(95, 50 + ((value - eliteMedian) / eliteMedian) * 60);
    }
    if (value <= 0) return 80;
    return Math.max(10, 80 - (value / eliteMedian) * 60);
  }
  function avgScores(scores) {
    const valid = scores.filter(s => s != null);
    if (valid.length === 0) return null;
    return valid.reduce((a, b) => a + b, 0) / valid.length;
  }
  // ⭐ v25 — v24 가중치 7그룹과 일치하는 RadarChart 데이터
  //   각 그룹의 점수는 그룹 내 변인 점수의 가중 평균
  //   가중치는 calcVelocityScore와 동일
  function buildVelocityRadar(sm, energy, kineticChain, precision) {
    function pwLin(v, anchors) {
      if (v == null || isNaN(v)) return null;
      if (v <= anchors[0][0]) return Math.max(0, anchors[0][1] * (v / anchors[0][0]));
      for (let i = 1; i < anchors.length; i++) {
        if (v <= anchors[i][0]) {
          const [x0, y0] = anchors[i-1], [x1, y1] = anchors[i];
          return y0 + (v - x0) / (x1 - x0) * (y1 - y0);
        }
      }
      const last = anchors[anchors.length - 1];
      return Math.min(100, last[1] + (v - last[0]) * 0.05);
    }
    function targetScore(val, target, fwhm, max) {
      if (val == null) return null;
      const dist = Math.abs(val - target);
      const score = max * Math.exp(-Math.LN2 * (dist / fwhm) * (dist / fwhm));
      return Math.max(20, score);
    }
    function rangeScore(v, lo, hi) {
      if (v == null) return null;
      if (v >= lo && v <= hi) return 90;
      const mid = (lo + hi) / 2, range = (hi - lo) / 2;
      const off = Math.abs(v - mid);
      if (off <= range * 1.5) return 70 - (off - range) / (range * 0.5) * 10;
      if (off <= range * 2.5) return 60 - (off - range * 1.5) / range * 15;
      return Math.max(20, 45 - (off - range * 2.5) / range * 10);
    }
    function avg(arr) {
      const valid = arr.filter(x => x != null && !isNaN(x));
      if (valid.length === 0) return null;
      return valid.reduce((s, v) => s + v, 0) / valid.length;
    }
    function disp(v) { return v == null ? '—' : Math.round(v).toString(); }

    // [A] 키네틱 체인 (0.30) — ETI P→T, ETI T→A, 누수%, 시퀀싱
    const kineticParts = [
      sm.etiPT?.mean != null ? pwLin(sm.etiPT.mean, [[0.5,10],[0.8,30],[1.2,55],[1.5,75],[1.8,90],[2.2,98]]) : null,
      sm.etiTA?.mean != null ? pwLin(sm.etiTA.mean, [[0.5,10],[0.8,30],[1.2,55],[1.5,75],[1.8,90],[2.2,98]]) : null,
      energy?.leakPct != null ? Math.max(0, Math.min(100, 95 - energy.leakPct * 1.7)) : null,
      sm.ptLagMs?.mean != null && sm.taLagMs?.mean != null
        ? (rangeScore(sm.ptLagMs.mean, 25, 65) + rangeScore(sm.taLagMs.mean, 15, 45)) / 2
        : null
    ];
    const kineticScore = avg(kineticParts);

    // [B] Arm Action (0.18) — Layback, Shoulder Abd FP, Scap Load FP
    const shAbdFP = sm.shoulderAbdFP?.mean ?? sm.shoulderAbductionFP?.mean;
    const scapLoad = sm.scapLoadFP?.mean ?? sm.scapulaLoadFP?.mean ?? sm.scapLoad?.mean;
    const armActionParts = [
      sm.maxER?.mean != null ? pwLin(sm.maxER.mean, [[140,20],[170,55],[185,75],[200,92]]) : null,
      shAbdFP != null ? pwLin(shAbdFP, [[60,30],[80,65],[90,85],[100,90]]) : null,
      scapLoad != null ? pwLin(scapLoad, [[20,30],[40,55],[55,80],[75,93]]) : null
    ];
    const armActionScore = avg(armActionParts);

    // [C] Posture (0.18) — Hip-Shoulder Sep FP, Trunk fwd tilt FP, Counter Rot, Trunk Rot FP
    const hssVal = sm.hipShoulderSep?.mean ?? sm.hipShoulderSepFP?.mean ?? sm.maxXFactor?.mean;
    const tftFP = sm.torsoFwdTiltFP?.mean ?? sm.trunkFwdTiltFP?.mean ?? sm.trunkForwardTiltAtFC?.mean;
    const ptcr = sm.peakTorsoCounterRot?.mean ?? sm.torsoCounterRot?.mean;
    const trFP = sm.torsoRotFP?.mean ?? sm.trunkRotFP?.mean ?? sm.trunkRotAtFP?.mean;
    const postureParts = [
      hssVal != null ? pwLin(hssVal, [[10,20],[20,45],[30,75],[40,90],[50,95]]) : null,
      tftFP != null ? pwLin(tftFP, [[-10,30],[0,55],[5,75],[15,90]]) : null,
      ptcr != null ? pwLin(Math.abs(ptcr), [[5,20],[20,45],[37,75],[50,90]]) : null,
      trFP != null ? targetScore(trFP, 2, 10, 90) : null
    ];
    const postureScore = avg(postureParts);

    // [D] Rotation (0.10) — Trunk Rotation Velo
    const rotationScore = sm.peakTrunkVel?.mean != null
      ? pwLin(sm.peakTrunkVel.mean, [[600,30],[750,55],[900,78],[1050,92]])
      : null;

    // [E] Block (0.09) — Lead Knee Ext at BR, Stride ratio
    const blockParts = [
      sm.leadKneeExtAtBR?.mean != null ? pwLin(sm.leadKneeExtAtBR.mean, [[-30,15],[-15,35],[0,55],[10,78],[20,92]]) : null,
      sm.strideRatio?.mean != null ? pwLin(sm.strideRatio.mean, [[0.5,15],[0.7,40],[0.8,65],[0.85,80],[0.92,90],[1.0,85]]) : null
    ];
    const blockScore = avg(blockParts);

    // [F] CoG (0.05) — CoG Decel
    const cogScore = sm.cogDecel?.mean != null
      ? pwLin(sm.cogDecel.mean, [[0.5,20],[1.0,45],[1.4,70],[1.6,82],[2.0,95]])
      : null;

    // [G] 절대 KE/Power (0.10) — peakPowerArm, KE_arm
    const powerParts = [
      kineticChain?.peakPowerArm != null ? pwLin(kineticChain.peakPowerArm, [[1000,15],[1500,30],[2500,55],[3500,75],[4500,92]]) : null,
      kineticChain?.KE_arm?.val != null ? pwLin(kineticChain.KE_arm.val, [[80,25],[120,50],[160,75],[200,90]]) : null
    ];
    const powerScore = avg(powerParts);

    // RadarChart 데이터: 0-100 점수를 lo=50, hi=80 기준으로 표시
    return [
      { label: '키네틱 체인',    sub: 'ETI · 누수 · 시퀀싱',          weight: 0.30,
        dlMapping: '⭐ 우리 시스템 고유 + 사용자 강조',
        value: kineticScore, lo: 50, hi: 80, display: disp(kineticScore), isOurOwn: true },
      { label: 'Arm Action',     sub: 'Layback · Sh.Abd · Scap Load', weight: 0.18,
        dlMapping: 'Driveline 모델 #2 (영향력 2위)',
        value: armActionScore, lo: 50, hi: 80, display: disp(armActionScore), isOurOwn: false },
      { label: 'Posture',        sub: 'Hip-Sh.Sep · Counter Rot · Trunk',  weight: 0.18,
        dlMapping: 'Driveline 모델 #1 (영향력 1위)',
        value: postureScore, lo: 50, hi: 80, display: disp(postureScore), isOurOwn: false },
      { label: 'Rotation',       sub: 'Trunk Rotation Velo (단일)',    weight: 0.10,
        dlMapping: 'Driveline 1.0 (기준 변인)',
        value: rotationScore, lo: 50, hi: 80, display: disp(rotationScore), isOurOwn: false },
      { label: 'Block',          sub: 'Lead Knee Ext · Stride',        weight: 0.09,
        dlMapping: 'Driveline 모델 #5',
        value: blockScore, lo: 50, hi: 80, display: disp(blockScore), isOurOwn: false },
      { label: 'CoG',            sub: 'CoG Decel (단일)',              weight: 0.05,
        dlMapping: 'Driveline 모델 #4 (0.70 high)',
        value: cogScore, lo: 50, hi: 80, display: disp(cogScore), isOurOwn: false },
      { label: '절대 KE/Power',  sub: 'Peak Power Arm · KE_arm',       weight: 0.10,
        dlMapping: '⭐ 학술 + 4명 데이터 검증',
        value: powerScore, lo: 50, hi: 80, display: disp(powerScore), isOurOwn: true }
    ];
  }

  // ═════════════════════════════════════════════════════════════════
  // Consistency 데이터 (Section D — 제구 일관성, 5 영역별 카드)
  // files report.jsx Section 7 ConsistencyCard 데이터 포팅
  // ═════════════════════════════════════════════════════════════════
  function consistencyTone(value, threshold, lowerBetter) {
    if (value == null) return { tone: 'na', text: '—' };
    if (lowerBetter) {
      if (value <= threshold.elite) return { tone: 'good', text: '엘리트' };
      if (value <= threshold.good)  return { tone: 'mid',  text: '양호' };
      if (value <= threshold.ok)    return { tone: 'low',  text: '주의' };
      return { tone: 'bad', text: '부족' };
    }
    if (value >= threshold.elite) return { tone: 'good', text: '엘리트' };
    return { tone: 'mid', text: '—' };
  }
  function buildConsistency(sm, command) {
    const dByKey = command?.domains
      ? Object.fromEntries(command.domains.map(d => [d.key, d]))
      : {};
    function gradeOf(key) { return dByKey[key]?.grade || null; }

    // wrist height SD (m → cm 변환)
    const wristSdCm = sm.wristHeight?.sd != null ? sm.wristHeight.sd * 100 : null;

    return {
      // 1. Foot Contact — 키네틱 체인 시작점
      footContact: {
        grade: gradeOf('footContact'),
        cards: [
          { label: 'Stride 길이', value: r1(sm.strideLength?.cv), unit: 'CV%',
            threshold: { elite: 1.5, good: 3, ok: 5 }, lowerBetter: true,
            description: '디딤발 위치 일관성',
            ...consistencyTone(sm.strideLength?.cv, { elite: 1.5, good: 3, ok: 5 }, true) },
          { label: 'FC 무릎 굴곡', value: r1(sm.frontKneeFlex?.cv), unit: 'CV%',
            threshold: { elite: 5, good: 8, ok: 12 }, lowerBetter: true,
            description: '앞다리 무릎 굴곡 각도 일관성',
            ...consistencyTone(sm.frontKneeFlex?.cv, { elite: 5, good: 8, ok: 12 }, true) },
          { label: 'FC 시점 몸통 회전', value: r1(sm.trunkRotAtFP?.sd), unit: '° SD',
            threshold: { elite: 3, good: 5, ok: 8 }, lowerBetter: true,
            description: 'FC에서 몸통 회전 각 일관성',
            ...consistencyTone(sm.trunkRotAtFP?.sd, { elite: 3, good: 5, ok: 8 }, true) }
        ].filter(c => c.value != null)
      },
      // 2. Sequencing
      sequencing: {
        grade: gradeOf('sequencing'),
        cards: [
          { label: 'P→T 시퀀싱 (lag CV)', value: r1(sm.ptLagMs?.cv), unit: 'CV%',
            threshold: { elite: 8, good: 12, ok: 18 }, lowerBetter: true,
            description: '골반-몸통 가속 간격 일관성',
            ...consistencyTone(sm.ptLagMs?.cv, { elite: 8, good: 12, ok: 18 }, true) },
          { label: 'T→A 시퀀싱 (lag CV)', value: r1(sm.taLagMs?.cv), unit: 'CV%',
            threshold: { elite: 8, good: 12, ok: 18 }, lowerBetter: true,
            description: '몸통-팔 가속 간격 일관성',
            ...consistencyTone(sm.taLagMs?.cv, { elite: 8, good: 12, ok: 18 }, true) }
        ].filter(c => c.value != null)
      },
      // 3. Power Output
      powerOutput: {
        grade: gradeOf('powerOutput'),
        cards: [
          { label: 'Max ER 일관성', value: r1(sm.maxER?.cv), unit: 'CV%',
            threshold: { elite: 1.5, good: 3, ok: 5 }, lowerBetter: true,
            description: '최대 외회전 각도 일관성',
            ...consistencyTone(sm.maxER?.cv, { elite: 1.5, good: 3, ok: 5 }, true) },
          { label: '팔 각속도 일관성', value: r1(sm.peakArmVel?.cv), unit: 'CV%',
            threshold: { elite: 2, good: 4, ok: 7 }, lowerBetter: true,
            description: '상완 회전 속도의 시기 간 변동',
            ...consistencyTone(sm.peakArmVel?.cv, { elite: 2, good: 4, ok: 7 }, true) },
          { label: '몸통 각속도 일관성', value: r1(sm.peakTrunkVel?.cv), unit: 'CV%',
            threshold: { elite: 2, good: 4, ok: 7 }, lowerBetter: true,
            description: '몸통 회전 속도 일관성',
            ...consistencyTone(sm.peakTrunkVel?.cv, { elite: 2, good: 4, ok: 7 }, true) },
          { label: 'X-factor 일관성', value: r1(sm.maxXFactor?.cv), unit: 'CV%',
            threshold: { elite: 4, good: 7, ok: 12 }, lowerBetter: true,
            description: '골반-몸통 분리각 일관성',
            ...consistencyTone(sm.maxXFactor?.cv, { elite: 4, good: 7, ok: 12 }, true) }
        ].filter(c => c.value != null)
      },
      // 4. Release Position
      releasePos: {
        grade: gradeOf('releasePos'),
        cards: [
          { label: '손목 높이', value: r2(wristSdCm), unit: 'cm SD',
            threshold: { elite: 2, good: 4, ok: 6 }, lowerBetter: true,
            description: '릴리스 포인트의 수직 일관성',
            ...consistencyTone(wristSdCm, { elite: 2, good: 4, ok: 6 }, true) },
          { label: 'Arm slot 각도', value: r2(sm.armSlotAngle?.sd), unit: '° SD',
            threshold: { elite: 2, good: 3, ok: 5 }, lowerBetter: true,
            description: '팔 각도(슬롯)의 시기 간 변동',
            ...consistencyTone(sm.armSlotAngle?.sd, { elite: 2, good: 3, ok: 5 }, true) },
          { label: '몸통 전방 기울기', value: r2(sm.trunkForwardTilt?.sd), unit: '° SD',
            threshold: { elite: 2, good: 4, ok: 6 }, lowerBetter: true,
            description: '릴리스 시 몸통 자세 일관성',
            ...consistencyTone(sm.trunkForwardTilt?.sd, { elite: 2, good: 4, ok: 6 }, true) }
        ].filter(c => c.value != null)
      },
      // 5. Release Timing
      releaseTiming: {
        grade: gradeOf('releaseTiming'),
        cards: [
          { label: 'FC → 릴리스 시간 (CV)', value: r1(sm.fcBrMs?.cv), unit: 'CV%',
            threshold: { elite: 2, good: 5, ok: 10 }, lowerBetter: true,
            description: '앞발 착지 ~ 공 놓기까지 소요시간 변동 (제구 핵심)',
            ...consistencyTone(sm.fcBrMs?.cv, { elite: 2, good: 5, ok: 10 }, true) },
          { label: 'FC → 릴리스 시간 (절대)', value: r0(sm.fcBrMs?.mean), unit: 'ms',
            threshold: null, lowerBetter: false,
            description: '평균 소요시간. 일관성과 별개로 절대 시간',
            tone: 'na', text: '—' }
        ].filter(c => c.value != null)
      }
    };
  }

  // ═════════════════════════════════════════════════════════════════
  // Summary Scores (Section E — 종합 평가)
  //   ① 구속 점수 (메카닉 기반, files calcVelocityScore)
  //   ② 제구 점수 (일관성 기반, files calcCommandScore)
  //   ③ 체력 점수 (NEW! BBL 메타 CSV 기반)
  //   ④ 종합 점수 (가중 평균)
  //   ⑤ 우선순위 개선점 (구속·제구·체력 약점 통합)
  // ═════════════════════════════════════════════════════════════════
  function scoreToGrade(score) {
    if (score == null || isNaN(score)) return '—';
    if (score >= 92) return 'A+';
    if (score >= 85) return 'A';
    if (score >= 78) return 'A-';
    if (score >= 72) return 'B+';
    if (score >= 65) return 'B';
    if (score >= 58) return 'B-';
    if (score >= 52) return 'C+';
    if (score >= 45) return 'C';
    if (score >= 38) return 'C-';
    if (score >= 30) return 'D+';
    if (score >= 22) return 'D';
    return 'F';
  }
  // ⭐ v24 — 드라이브라인 모델 + 학술 + 키네틱 체인 통합
  //   드라이브라인 5개 모델 영향력 순위 (구속 예측):
  //     1) Posture          — 가장 큰 영향
  //     2) Arm Action       — 2번째
  //     3) Rotation         — 4번째 (예상 초과 시 3번째)
  //     4) CoG              — 4번째 (예상 초과 시 5번째)
  //     5) Block            — 5번째 (예상 초과 시 4번째)
  //
  //   드라이브라인 상대 중요도 (Trunk Rot Velo = 1.0 기준):
  //     Trunk Rotation Velo  1.00  high
  //     Layback (MER)        0.86  high  ⭐
  //     CoG Decel            0.70  high
  //     Lead Knee Extension  0.58  high
  //     Stride Length        0.58  high
  //     Elbow Ext Velo       0.56  med
  //     Shoulder Abd FP      0.51  med
  //     Hip-Shoulder Sep FP  0.44  med
  //     Peak Torso Counter   0.38  med
  //     Scap Load at FP      0.37  med
  //     Shoulder IR Velo     0.36  med
  //     Torso Fwd Tilt FP    0.36  med
  //     Torso Rot at FP      0.35  med
  //
  //   v24 가중치 그룹 (총 1.00):
  //     [A] 키네틱 체인 (사용자 강조)   0.28
  //     [B] Posture (드라이브라인 #1) 0.16
  //     [C] Arm Action (드라이브라인 #2) 0.16
  //     [D] Rotation                  0.09
  //     [E] Block                     0.09
  //     [F] CoG                       0.06
  //     [G] 절대 KE/Power             0.16
  //   합계 = 1.00
  function calcVelocityScore(sm, energy, kineticChain, precision) {
    function pwLinear(val, anchors) {
      if (val == null || isNaN(val)) return null;
      if (val <= anchors[0][0]) return Math.max(0, anchors[0][1] * (val / anchors[0][0]));
      for (let i = 1; i < anchors.length; i++) {
        if (val <= anchors[i][0]) {
          const [x0, y0] = anchors[i-1], [x1, y1] = anchors[i];
          return y0 + (val - x0) / (x1 - x0) * (y1 - y0);
        }
      }
      const last = anchors[anchors.length - 1];
      return Math.min(100, last[1] + (val - last[0]) * 0.05);
    }
    const parts = [];
    const sources = [];
    function push(group, name, w, val, anchors, unit) {
      const score = pwLinear(val, anchors);
      if (Number.isFinite(score)) {
        parts.push({ w, v: score });
        sources.push({ group, name, weight: w, value: val, unit, score: Math.round(score) });
      }
    }
    // 점선 score (목표값 가까울수록 좋음 - 양방향)
    function targetScore(val, target, fwhm, max) {
      // val가 target 정확히 = max점, target±fwhm 거리 시 max/2
      if (val == null) return null;
      const dist = Math.abs(val - target);
      const score = max * Math.exp(-Math.LN2 * (dist / fwhm) * (dist / fwhm));
      return Math.max(20, score);
    }

    // ════════════════════════════════════════════════════════
    // [A] 키네틱 체인 (사용자 강조 + 우리 고유 강점) — 0.28 ⭐
    // ════════════════════════════════════════════════════════
    // ETI P→T (골반 → 몸통 KE 효율) — 0.07
    if (sm.etiPT?.mean != null) {
      push('kinetic', 'ETI P→T (골반→몸통 효율)', 0.07, sm.etiPT.mean,
        [[0.5,10],[0.8,30],[1.2,55],[1.5,75],[1.8,90],[2.2,98]], '×');
    }
    // ETI T→A (몸통 → 상완 KE 효율) — 0.07
    if (sm.etiTA?.mean != null) {
      push('kinetic', 'ETI T→A (몸통→상완 효율)', 0.07, sm.etiTA.mean,
        [[0.5,10],[0.8,30],[1.2,55],[1.5,75],[1.8,90],[2.2,98]], '×');
    }
    // 에너지 누수 % — 0.10 (사용자 강조)
    if (energy?.leakPct != null) {
      const leakScore = Math.max(0, Math.min(100, 95 - energy.leakPct * 1.7));
      parts.push({ w: 0.10, v: leakScore });
      sources.push({ group: 'kinetic', name: '에너지 누수 % (낮을수록 좋음)',
        weight: 0.10, value: energy.leakPct, unit: '%', score: Math.round(leakScore) });
    }
    // 시퀀싱 P→T→A 타이밍 — 0.04
    //   Howenstein 2019 elite range: P→T 25-65ms, T→A 15-45ms
    if (sm.ptLagMs?.mean != null && sm.taLagMs?.mean != null) {
      function rangeScore(v, lo, hi) {
        if (v == null) return null;
        if (v >= lo && v <= hi) return 90;
        const mid = (lo + hi) / 2;
        const range = (hi - lo) / 2;
        const off = Math.abs(v - mid);
        if (off <= range * 1.5) return 70 - (off - range) / (range * 0.5) * 10;
        if (off <= range * 2.5) return 60 - (off - range * 1.5) / range * 15;
        return Math.max(20, 45 - (off - range * 2.5) / range * 10);
      }
      const ptScore = rangeScore(sm.ptLagMs.mean, 25, 65);
      const taScore = rangeScore(sm.taLagMs.mean, 15, 45);
      const valid = [ptScore, taScore].filter(x => x != null);
      if (valid.length > 0) {
        const score = valid.reduce((a, b) => a + b, 0) / valid.length;
        parts.push({ w: 0.04, v: score });
        sources.push({ group: 'kinetic', name: '시퀀싱 타이밍 (P→T→A lag)',
          weight: 0.04,
          value: `${sm.ptLagMs.mean.toFixed(0)}/${sm.taLagMs.mean.toFixed(0)}`,
          unit: 'ms', score: Math.round(score) });
      }
    }

    // ════════════════════════════════════════════════════════
    // [B] Posture — 드라이브라인 #1 영향력 (0.16)
    // ════════════════════════════════════════════════════════
    // Hip-shoulder separation at FP — 0.05 (드라이브라인 0.44, "high")
    const hssVal = sm.hipShoulderSep?.mean ?? sm.hipShoulderSepFP?.mean ?? sm.hipShoulderSeparation?.mean;
    if (hssVal != null) {
      push('posture', 'Hip-Shoulder 분리각 at FP', 0.05, hssVal,
        [[10,20],[20,45],[30,75],[40,90],[50,95]], '°');
    }
    // Torso forward tilt — 0.04 (드라이브라인 0.36)
    const tftFP = sm.torsoFwdTiltFP?.mean ?? sm.trunkFwdTiltFP?.mean;
    const tftBR = sm.trunkForwardTilt?.mean;
    if (tftFP != null) {
      push('posture', 'Torso forward tilt at FP', 0.04, tftFP,
        [[-10,30],[0,55],[5,75],[15,90]], '°');
    } else if (tftBR != null) {
      push('posture', 'Torso forward tilt at BR (mean)', 0.04, tftBR,
        [[10,20],[25,55],[35,78],[45,92]], '°');
    }
    // Peak Torso Counter Rotation — 0.04 (드라이브라인 0.38)
    const ptcr = sm.torsoCounterRot?.mean ?? sm.peakTorsoCounterRot?.mean;
    if (ptcr != null) {
      const absVal = Math.abs(ptcr);
      push('posture', 'Peak Torso Counter Rotation', 0.04, absVal,
        [[5,20],[20,45],[37,75],[50,90]], '°');
    }
    // Torso rotation at FP — 0.03 (드라이브라인 0.35)
    const trFP = sm.torsoRotFP?.mean ?? sm.trunkRotFP?.mean;
    if (trFP != null) {
      const score = targetScore(trFP, 2, 10, 90);
      if (Number.isFinite(score)) {
        parts.push({ w: 0.03, v: score });
        sources.push({ group: 'posture', name: 'Torso rotation at FP (덜 열림)',
          weight: 0.03, value: trFP, unit: '°', score: Math.round(score) });
      }
    }

    // ════════════════════════════════════════════════════════
    // [C] Arm Action — 드라이브라인 #2 영향력 (0.16)
    // ════════════════════════════════════════════════════════
    // Layback (MER) — 0.09 ⭐ (드라이브라인 0.86, 매우 높음)
    if (sm.maxER?.mean != null) {
      push('armaction', 'Layback (MER)', 0.09, sm.maxER.mean,
        [[140,20],[170,55],[185,75],[200,92]], '°');
    }
    // Shoulder Abduction at FP — 0.04 (드라이브라인 0.51)
    const shAbdFP = sm.shoulderAbdFP?.mean ?? sm.shoulderAbductionFP?.mean;
    if (shAbdFP != null) {
      push('armaction', 'Shoulder Abduction at FP', 0.04, shAbdFP,
        [[60,30],[80,65],[90,85],[100,90]], '°');
    }
    // Scap Load at FP — 0.03 (드라이브라인 0.37)
    const scapLoad = sm.scapLoadFP?.mean ?? sm.scapulaLoadFP?.mean ?? sm.scapLoad?.mean;
    if (scapLoad != null) {
      push('armaction', 'Scap Load at FP', 0.03, scapLoad,
        [[20,30],[40,55],[55,80],[75,93]], '°');
    }

    // ════════════════════════════════════════════════════════
    // [D] Rotation — 드라이브라인 #3 영향력 (0.09)
    // ════════════════════════════════════════════════════════
    // Torso Rotation Velo — 0.09 (드라이브라인 1.0, 기준 변인)
    if (sm.peakTrunkVel?.mean != null) {
      push('rotation', 'Torso Rotation Velo', 0.09, sm.peakTrunkVel.mean,
        [[600,30],[750,55],[900,78],[1050,92]], '°/s');
    }

    // ════════════════════════════════════════════════════════
    // [E] Block — 드라이브라인 #4 영향력 (0.09)
    // ════════════════════════════════════════════════════════
    // Lead Knee Extension at BR — 0.05 (드라이브라인 0.58)
    if (sm.leadKneeExtAtBR?.mean != null) {
      push('block', 'Lead Knee Extension at BR', 0.05, sm.leadKneeExtAtBR.mean,
        [[-30,15],[-15,35],[0,55],[10,78],[20,92]], '°');
    }
    // Stride ratio (Stride Length % body height) — 0.04 (드라이브라인 0.58)
    if (sm.strideRatio?.mean != null && Number.isFinite(sm.strideRatio.mean)) {
      push('block', 'Stride ratio (% body height)', 0.04, sm.strideRatio.mean,
        [[0.5,15],[0.7,40],[0.8,65],[0.85,80],[0.92,90],[1.0,85]], '×height');
    }

    // ════════════════════════════════════════════════════════
    // [F] CoG — 드라이브라인 #5 영향력 (0.06)
    //   ⭐ v23에서 잘못 제거한 것을 드라이브라인 검증으로 다시 추가
    // ════════════════════════════════════════════════════════
    // CoG Decel — 0.06 (드라이브라인 0.70)
    if (sm.cogDecel?.mean != null) {
      push('cog', 'CoG Decel', 0.06, sm.cogDecel.mean,
        [[0.5,20],[1.0,45],[1.4,70],[1.6,82],[2.0,95]], 'm/s');
    }

    // ════════════════════════════════════════════════════════
    // [G] 절대 KE/Power — 학술 + 4명 데이터 검증 (0.16)
    //   드라이브라인엔 직접 대응 변인 없지만 매우 강한 판별 신호
    //   - Sakurai 2024: CMJ Peak Power 절대값 r=0.68
    //   - Naito 2014: cocking phase arm power
    //   - 4명 데이터: 권준서 1513W vs 강한 선수 3300-4300W (절반 이하)
    // ════════════════════════════════════════════════════════
    // peakPowerArm (W) — 0.10 ⭐ (가장 강한 판별 신호)
    //   한국 고교 baseline (4명 데이터 기반): 1500=낮음, 2700=평균, 3500+=우수
    if (kineticChain?.peakPowerArm != null) {
      push('power', 'Peak Power Arm (W, 절대값)', 0.10, kineticChain.peakPowerArm,
        [[1000,12],[1500,25],[2200,45],[3000,68],[3800,85],[4500,93]], 'W');
    }
    // KE_arm 절대값 (J) — 0.04
    if (kineticChain?.KE_arm?.val != null) {
      push('power', 'KE_arm (J, 절대 운동에너지)', 0.04, kineticChain.KE_arm.val,
        [[80,25],[120,50],[160,75],[200,90]], 'J');
    }
    // cockPowerWPerKg — 0.02 (Naito 2014, 보조)
    if (precision?.cockPowerWPerKg != null) {
      push('power', 'Cocking Power (W/kg)', 0.02, precision.cockPowerWPerKg,
        [[10,15],[20,40],[30,65],[45,88],[55,98]], 'W/kg');
    }

    // ════════════════════════════════════════════════════════
    // 합산 (일부 변인이 BBLAnalysis 출력에 없으면 자동 정규화)
    // ════════════════════════════════════════════════════════
    if (parts.length === 0) return { score: null, sources: [] };
    const totalW = parts.reduce((s, p) => s + p.w, 0);
    if (totalW === 0) return { score: null, sources: [] };
    const score = parts.reduce((s, p) => s + p.v * p.w, 0) / totalW;
    return Number.isFinite(score) ? { score, sources } : { score: null, sources };
  }
  // ⭐ v26 — 제구 점수 4그룹 카테고리화 (사용자 요청 + 학술 근거)
  //   사용자 가설:
  //     · 근본 원인 = 앞발 착지 안정성 + 회전 타이밍
  //     · 결과 변인 = 릴리즈 포인트, 암 슬롯, 머리 (downstream)
  //   학술 근거:
  //     · Manzi 2019 (PMC8387831, n=47) — 5변인 회귀 ball location 분산 58% 설명
  //                                       3변인 at FC + 2변인 at MER
  //     · Manzi 2021 (n=322) — Trunk tilt at FC = 6.6% MSE (#1)
  //                            Lead hip flexion at FC = 4.2% MSE (#2)
  //                            Shoulder abduction at FC = 4.2% MSE (#3)
  //     · Fleisig/Driveline — 청소년 vs 엘리트 차이: front foot placement + flexion at foot plant
  //     · Wang 2025 — pelvic rotation variability r=−0.78 (transverse plane)
  //     · Howenstein 2021 (n=88) — KS 패턴 11개, 시퀀싱 일관성이 핵심
  //     · Wakamiya 2024 (PMC11608975, n=344 MLB) — release point variability ↓ → BB/9·xFIP 개선
  //
  //   가중치 분배:
  //     [A] 앞발 착지 안정성 (사용자 강조 + 학술 핵심)  0.40
  //     [B] 회전 타이밍 (사용자 강조 + Wang 2025)        0.30
  //     [C] 자세 일관성 (Manzi 2021 #1)                  0.18
  //     [D] 릴리즈 결과 (downstream)                     0.12
  //     합계 = 1.00
  function calcCommandScore(sm) {
    const parts = [];
    const sources = [];

    // anchor 기반 점수 변환 (낮을수록 좋음 변인용)
    function lowerBetterScore(val, anchors) {
      // anchors: [[elite_threshold, 95], [good, 75], [ok, 50], [poor, 25]]
      if (val == null || isNaN(val)) return null;
      if (val <= anchors[0][0]) return Math.min(100, anchors[0][1] + 5);
      if (val <= anchors[1][0]) {
        const r = (val - anchors[0][0]) / (anchors[1][0] - anchors[0][0]);
        return anchors[0][1] - r * (anchors[0][1] - anchors[1][1]);
      }
      if (val <= anchors[2][0]) {
        const r = (val - anchors[1][0]) / (anchors[2][0] - anchors[1][0]);
        return anchors[1][1] - r * (anchors[1][1] - anchors[2][1]);
      }
      if (val <= anchors[3][0]) {
        const r = (val - anchors[2][0]) / (anchors[3][0] - anchors[2][0]);
        return anchors[2][1] - r * (anchors[2][1] - anchors[3][1]);
      }
      return Math.max(5, anchors[3][1] - (val - anchors[3][0]) * 2);
    }

    function push(group, name, weight, val, anchors, unit) {
      const score = lowerBetterScore(val, anchors);
      if (Number.isFinite(score)) {
        parts.push({ w: weight, v: score });
        sources.push({
          group, name, weight,
          value: typeof val === 'number' ? val.toFixed(2) : val,
          unit, score: Math.round(score)
        });
      }
    }

    // ════════════════════════════════════════════════════════
    // [A] 앞발 착지 안정성 (사용자 강조 — 가장 큰 가중치) — 0.40
    // ════════════════════════════════════════════════════════
    // 1. 스트라이드 길이 변동성 (CV) — 0.10
    //    Drives/Fleisig 청소년 vs 엘리트 차이의 핵심
    push('landing', '스트라이드 길이 일관성', 0.10, sm.strideLength?.cv,
      [[3,95],[5,75],[8,50],[15,25]], 'CV%');

    // 2. FC 시점 무릎 굴곡각 변동성 (SD) — 0.10
    //    Manzi 2021: lead hip flexion at FC = 4.2% MSE (#2)
    //    BBLAnalysis: kneeFlexionAtFC 또는 frontKneeFlex (FC 기준)
    const kneeFcSd = sm.kneeFlexionAtFC?.sd ?? sm.frontKneeFlex?.sd;
    push('landing', 'FC 무릎 굴곡각 변동성', 0.10, kneeFcSd,
      [[3,95],[5,75],[8,50],[12,25]], '° SD');

    // 3. FC→BR 무릎 굴곡-신장 일관성 (사용자 핵심 강조) — 0.10
    //    "착지 직후 무릎 짧은 굴곡 후 폭발적 신장" 패턴 안정성
    //    leadKneeExtAtBR의 SD가 작을수록 brace 효과 일관됨
    push('landing', 'FC→BR 무릎 신전 일관성', 0.10, sm.leadKneeExtAtBR?.sd,
      [[3,95],[5,75],[8,50],[12,25]], '° SD');

    // 4. FC 시점 lead hip 자세 변동성 (CV 또는 SD)
    //    Manzi 2021: lead hip flexion at FC = 4.2% MSE
    //    BR 시점 무릎 굴곡 (kneeFlexionAtBR) 변동성으로 대용
    const hipBrSd = sm.kneeFlexionAtBR?.sd;
    push('landing', 'BR 무릎 굴곡 일관성 (block 안정성)', 0.10, hipBrSd,
      [[3,95],[5,75],[8,50],[12,25]], '° SD');

    // ════════════════════════════════════════════════════════
    // [B] 회전 타이밍 (사용자 강조 + Wang 2025) — 0.30
    // ════════════════════════════════════════════════════════
    // 5. P→T lag 일관성 (CV) — 0.08
    //    Howenstein 2021: 시퀀싱 일관성이 핵심
    push('rotation', 'P→T lag 일관성', 0.08, sm.ptLagMs?.cv,
      [[15,95],[25,75],[40,50],[60,25]], 'CV%');

    // 6. T→A lag 일관성 (CV) — 0.08
    push('rotation', 'T→A lag 일관성', 0.08, sm.taLagMs?.cv,
      [[15,95],[25,75],[40,50],[60,25]], 'CV%');

    // 7. 골반 peak velocity 변동성 (CV) — 0.07
    //    Wang 2025: pelvic rotation variability r=−0.78 (가장 강한 단일 변동성 변인!)
    push('rotation', '골반 회전속도 변동성', 0.07, sm.peakPelvisVel?.cv,
      [[5,95],[10,75],[15,50],[22,25]], 'CV%');

    // 8. 몸통 peak velocity 변동성 (CV) — 0.07
    push('rotation', '몸통 회전속도 변동성', 0.07, sm.peakTrunkVel?.cv,
      [[5,95],[10,75],[15,50],[22,25]], 'CV%');

    // ════════════════════════════════════════════════════════
    // [C] 자세 일관성 (Manzi 2021 6.6% MSE) — 0.18
    // ════════════════════════════════════════════════════════
    // 9. FC 시점 몸통 전방 기울기 변동성 (SD) — 0.10
    //    Manzi 2021: Trunk tilt at FC = 가장 강한 정확도 예측 (6.6% MSE) ⭐
    //    BBLAnalysis: trunkForwardTiltAtFC가 FC 시점 변인 (BR 시점 trunkForwardTilt와 다름!)
    const trunkFcSd = sm.trunkForwardTiltAtFC?.sd ?? sm.trunkFlexAtFC?.sd;
    push('posture', 'FC 몸통 전방 기울기 변동성', 0.10, trunkFcSd,
      [[2,95],[4,75],[6,50],[10,25]], '° SD');

    // 10. FC 시점 몸통 회전각 변동성 (SD) — 0.08
    //     Manzi 2019: shoulder horizontal abduction at FC (몸통 정렬 변동의 대용)
    push('posture', 'FC 몸통 회전각 변동성', 0.08, sm.trunkRotAtFP?.sd,
      [[4,95],[7,75],[11,50],[16,25]], '° SD');

    // ════════════════════════════════════════════════════════
    // [D] 릴리즈 결과 (downstream — 사용자: 결과 지표) — 0.12
    // ════════════════════════════════════════════════════════
    // 11. Arm slot 각도 변동성 (SD) — 0.06
    //     사용자 언급 결과 변인 + Wakamiya 2024 release variability
    push('release', 'Arm slot 변동성', 0.06, sm.armSlotAngle?.sd,
      [[3,95],[5,75],[8,50],[12,25]], '° SD');

    // 12. 손목 높이 변동성 (SD, cm 단위) — 0.04
    //     Wakamiya 2024: release point vertical (RPZ) variability
    const wristSdCm = sm.wristHeight?.sd != null ? sm.wristHeight.sd * 100 : null;
    push('release', '손목 높이 변동성', 0.04, wristSdCm,
      [[2,95],[4,75],[6,50],[10,25]], 'cm SD');

    // 13. FC→BR 시간 일관성 (CV) — 0.02
    //     총체 timing의 결과
    push('release', 'FC→릴리스 시간 일관성', 0.02, sm.fcBrMs?.cv,
      [[2,95],[5,75],[10,50],[15,25]], 'CV%');

    if (parts.length === 0) return { score: null, sources: [] };
    const totalW = parts.reduce((s, p) => s + p.w, 0);
    const score = parts.reduce((s, p) => s + p.v * p.w, 0) / totalW;
    return { score, sources };
  }
  // 체력 점수 — ⭐ v23 학술 근거 기반 전면 재설계
  //   원칙:
  //   1. 절대값 강조 (Sakurai 2024: CMJ Concentric Impulse r=0.71, Peak Power(W) r=0.68)
  //   2. 단위파워(W/kg)는 보조 가중치 (분모 함정 방지)
  //   3. 악력 ↑ (PMC8929570 youth r=0.91)
  //   4. IMTP 절대값 추가 (절대 근력)
  //   가중치: 절대 파워/근력 0.45 + 단위 0.15 + 반응성 0.20 + 분절 근력 0.20 = 1.00
  function calcFitnessScore(physical) {
    if (!physical) return { score: null, sources: [] };
    const bandToScore = { high: 95, mid: 70, low: 40, na: null };
    const bandLabel = { high: '상위', mid: '범위', low: '미만', na: '—' };

    // 절대 파워(W) 점수표
    //   한국 고교 baseline: 2000W=30, 3000W=55, 3700W=78, 4500W=92, 5500W=98
    function absPowerScore(absW) {
      if (absW == null) return null;
      if (absW <= 2000) return Math.max(0, absW / 2000 * 30);
      if (absW <= 3000) return 30 + (absW - 2000) / 1000 * 25;
      if (absW <= 3700) return 55 + (absW - 3000) / 700 * 23;
      if (absW <= 4500) return 78 + (absW - 3700) / 800 * 14;
      return Math.min(100, 92 + (absW - 4500) / 1000 * 6);
    }

    // IMTP 절대값(N) 점수표
    //   한국 고교 baseline: 1500N=30, 2000N=55, 2500N=80, 3000N=95
    function imtpAbsScore(absN) {
      if (absN == null) return null;
      if (absN <= 1500) return Math.max(0, absN / 1500 * 30);
      if (absN <= 2000) return 30 + (absN - 1500) / 500 * 25;
      if (absN <= 2500) return 55 + (absN - 2000) / 500 * 25;
      return Math.min(100, 80 + (absN - 2500) / 500 * 15);
    }

    // 악력(kg) 점수표 — youth r=0.91, 강한 분절 근력 신호
    function gripScore(kg) {
      if (kg == null) return null;
      if (kg <= 30) return Math.max(0, kg / 30 * 20);
      if (kg <= 50) return 20 + (kg - 30) / 20 * 35;
      if (kg <= 65) return 55 + (kg - 50) / 15 * 25;
      return Math.min(100, 80 + (kg - 65) / 15 * 15);
    }

    // RSI-mod 점수표
    function rsiScore(v) {
      if (v == null) return null;
      if (v <= 0.2) return Math.max(0, v / 0.2 * 20);
      if (v <= 0.4) return 20 + (v - 0.2) / 0.2 * 35;
      if (v <= 0.55) return 55 + (v - 0.4) / 0.15 * 25;
      return Math.min(100, 80 + (v - 0.55) / 0.15 * 15);
    }

    // EUR 점수표
    function eurScore(v) {
      if (v == null) return null;
      if (v <= 0.7) return Math.max(0, v / 0.7 * 20);
      if (v <= 1.0) return 20 + (v - 0.7) / 0.3 * 35;
      if (v <= 1.25) return 55 + (v - 1.0) / 0.25 * 25;
      return Math.min(100, 80 + (v - 1.25) / 0.3 * 15);
    }

    const components = [
      // ════════════════════════════════════════════════════════
      // 그룹 1: 절대 파워/근력 — 총 0.45 ⭐ (Sakurai 2024 핵심)
      // ════════════════════════════════════════════════════════
      // CMJ peak power 절대값(W) — 0.20 (r=0.68)
      { w: 0.20, v: absPowerScore(physical.cmjPower?.cmjAbs),
        name: 'CMJ peak power (절대)',
        rawValue: physical.cmjPower?.cmjAbs, rawBand: null, unit: 'W' },
      // IMTP 절대값(N) — 0.15 (절대 근력)
      { w: 0.15, v: imtpAbsScore(physical.maxStrength?.abs),
        name: 'IMTP peak force (절대)',
        rawValue: physical.maxStrength?.abs, rawBand: null, unit: 'N' },
      // SJ 절대값(W) — 0.10 (concentric 폭발력)
      { w: 0.10, v: absPowerScore(physical.cmjPower?.sjAbs),
        name: 'SJ peak power (절대)',
        rawValue: physical.cmjPower?.sjAbs, rawBand: null, unit: 'W' },

      // ════════════════════════════════════════════════════════
      // 그룹 2: 단위 정규화 (보조) — 총 0.15
      // ════════════════════════════════════════════════════════
      // CMJ 단위파워(W/kg) — 0.08 (분모 함정 방지를 위해 보조 가중치)
      { w: 0.08, v: bandToScore[physical.cmjPower?.band] ?? null,
        name: 'CMJ 단위파워 (W/kg)',
        rawValue: physical.cmjPower?.cmj, rawBand: physical.cmjPower?.band, unit: 'W/kg' },
      // IMTP 단위근력(N/kg) — 0.07
      { w: 0.07, v: bandToScore[physical.maxStrength?.band] ?? null,
        name: 'IMTP 단위근력 (N/kg)',
        rawValue: physical.maxStrength?.perKg, rawBand: physical.maxStrength?.band, unit: 'N/kg' },

      // ════════════════════════════════════════════════════════
      // 그룹 3: 반응성/탄성 — 총 0.20
      // ════════════════════════════════════════════════════════
      // RSI-mod — 0.12
      { w: 0.12, v: rsiScore(physical.reactive?.cmj),
        name: '반응성 (RSI-mod)',
        rawValue: physical.reactive?.cmj, rawBand: physical.reactive?.band, unit: 'm/s' },
      // EUR (탄성 활용) — 0.08
      { w: 0.08, v: eurScore(physical.ssc?.value),
        name: '탄성 활용 (EUR)',
        rawValue: physical.ssc?.value, rawBand: physical.ssc?.band, unit: '' },

      // ════════════════════════════════════════════════════════
      // 그룹 4: 분절 근력 — 총 0.20 ⭐ (PMC8929570 youth r=0.91)
      // ════════════════════════════════════════════════════════
      // 악력(kg) — 0.20 (전완·손목 절대 근력, 분절 신호)
      { w: 0.20, v: gripScore(physical.release?.value),
        name: '악력 (절대)',
        rawValue: physical.release?.value, rawBand: physical.release?.band, unit: 'kg' }
    ];
    const valid = components.filter(c => c.v != null);
    if (valid.length === 0) return { score: null, sources: [] };
    const totalW = valid.reduce((s, c) => s + c.w, 0);
    const score = valid.reduce((s, c) => s + c.v * c.w, 0) / totalW;
    const sources = valid.map(c => ({
      name: c.name,
      weight: c.w,
      value: c.rawValue != null ? c.rawValue : '—',
      unit: c.unit,
      band: c.rawBand,
      bandLabel: c.rawBand ? bandLabel[c.rawBand] : null,
      score: Math.round(c.v)
    }));
    return { score, sources };
  }
  // 우선순위 개선점 (체력 + 메카닉 + 일관성 통합)
  // ⭐ v23 — 학술 근거 기반 + 키네틱 체인 강조
  function generatePriorities(scores, sm, energy, physical, kineticChain, precision) {
    const candidates = [];
    const { velocity, command, fitness } = scores;

    // ━━ 키네틱 체인 누수 (사용자 강조 — 가장 우선) ━━
    if (energy?.etiPT != null && energy.etiPT < 1.0) {
      candidates.push({ kind: 'kinetic',
        weight: 110,
        title: '골반→몸통 에너지 명확 누수',
        detail: `ETI P→T ${energy.etiPT.toFixed(2)}× (Aguinaldo 2019: efficient ≥ 1.5)`,
        action: '메디신볼 회전 스로우, 골반-몸통 분리 드릴 (X-band, hip turn), 코어 회전 강화'
      });
    } else if (energy?.etiPT != null && energy.etiPT < 1.3) {
      candidates.push({ kind: 'kinetic',
        weight: 90,
        title: '골반→몸통 에너지 부분 누수',
        detail: `ETI P→T ${energy.etiPT.toFixed(2)}× (목표 1.5+)`,
        action: '회전 시퀀싱 드릴, 코어 anti-rotation 훈련 병행'
      });
    }
    if (energy?.etiTA != null && energy.etiTA < 1.0) {
      candidates.push({ kind: 'kinetic',
        weight: 108,
        title: '몸통→상완 에너지 명확 누수',
        detail: `ETI T→A ${energy.etiTA.toFixed(2)}× (Aguinaldo 2019: efficient ≥ 1.5)`,
        action: '플라이오볼 (200g·100g) 회전 스로우, 어깨-가슴 외회전 가동성 강화'
      });
    } else if (energy?.etiTA != null && energy.etiTA < 1.3) {
      candidates.push({ kind: 'kinetic',
        weight: 88,
        title: '몸통→상완 에너지 부분 누수',
        detail: `ETI T→A ${energy.etiTA.toFixed(2)}× (목표 1.5+)`,
        action: '몸통 회전 → 팔 가속 시퀀싱 점검, scap 안정성 훈련'
      });
    }
    if (energy?.leakPct != null && energy.leakPct > 25) {
      candidates.push({ kind: 'kinetic',
        weight: 95,
        title: `종합 에너지 누수 ${energy.leakPct.toFixed(0)}%`,
        detail: `단계간 KE 손실 과다 (목표 < 15%)`,
        action: '키네틱 체인 통합 드릴 — 메디신볼 회전 + 플라이오볼 + 영상 분석'
      });
    }

    // ━━ 절대 KE/Power 부족 ━━
    if (kineticChain?.peakPowerArm != null && kineticChain.peakPowerArm < 2200) {
      candidates.push({ kind: 'power',
        weight: 100,
        title: 'Peak Power Arm 절대값 부족',
        detail: `${kineticChain.peakPowerArm.toFixed(0)}W (한국 고교 우수 3000+W)`,
        action: '체격·근육량 발달 + 회전 파워 훈련 (메디신볼·플라이오볼 + 스쿼트/데드리프트)'
      });
    }
    if (precision?.cockPowerWPerKg != null && precision.cockPowerWPerKg < 25) {
      candidates.push({ kind: 'power',
        weight: 92,
        title: 'Cocking phase 팔 파워 부족',
        detail: `${precision.cockPowerWPerKg.toFixed(1)} W/kg (Naito 2014 기준 30+)`,
        action: '어깨 외회전 강화, 코킹 가속 드릴, J-band 루틴'
      });
    }

    // ━━ 체력 약점 (절대값 + 단위값 조합) ━━
    if (physical?.cmjPower?.cmjAbs != null && physical.cmjPower.cmjAbs < 3000) {
      candidates.push({ kind: 'fitness',
        weight: 88,
        title: 'CMJ 절대 폭발력 부족',
        detail: `${physical.cmjPower.cmjAbs}W (Sakurai 2024 기준 r=0.68)`,
        action: '하체 근비대 + plyometric 훈련 + 점프 스쿼트'
      });
    }
    if (physical?.maxStrength?.abs != null && physical.maxStrength.abs < 2000) {
      candidates.push({ kind: 'fitness',
        weight: 85,
        title: 'IMTP 절대 근력 부족',
        detail: `${physical.maxStrength.abs}N (한국 고교 우수 2300+N)`,
        action: '4주 maximal strength block — 스쿼트/데드리프트/벤치 3RM 2-3세트'
      });
    }
    if (physical?.release?.value != null && physical.release.value < 50) {
      candidates.push({ kind: 'fitness',
        weight: 80,
        title: '악력 (분절 근력) 부족',
        detail: `${physical.release.value}kg (PMC8929570 youth r=0.91)`,
        action: 'farmer carry, dead hang, 그립 강화 훈련'
      });
    }
    if (physical?.reactive?.band === 'low') {
      candidates.push({ kind: 'fitness',
        weight: 78,
        title: '반응성·SSC 보강',
        detail: `RSI-mod ${physical.reactive.cmj ?? '—'} m/s · 빠른 반동 부족`,
        action: '드롭 점프, 알트 점프, 짧은 접지시간 plyometric (CT < 200ms)'
      });
    }

    // ━━ 핵심 메카닉 ━━
    if (sm.peakTrunkVel?.mean != null && sm.peakTrunkVel.mean < 700) {
      candidates.push({ kind: 'mechanic',
        weight: 75,
        title: '몸통 회전 속도 부족',
        detail: `${sm.peakTrunkVel.mean.toFixed(0)}°/s (Orishimo 2023 / Driveline 평균 969°/s)`,
        action: '몸통 회전 가속 드릴, 코어 power 훈련, 회전 throw 변형'
      });
    }
    // Layback (MER) 부족 — 드라이브라인 0.86 (매우 높음)
    if (sm.maxER?.mean != null && sm.maxER.mean < 165) {
      candidates.push({ kind: 'mechanic',
        weight: 73,
        title: 'Layback (어깨 외회전) 부족',
        detail: `${sm.maxER.mean.toFixed(0)}° (Driveline 엘리트 190° · Per 1mph 5°)`,
        action: 'sleeper stretch, 어깨 외회전 가동성, J-band, 코킹 가속 드릴'
      });
    }
    // CoG Decel 부족 — 드라이브라인 0.70 (4번째 영향력)
    if (sm.cogDecel?.mean != null && sm.cogDecel.mean < 1.2) {
      candidates.push({ kind: 'mechanic',
        weight: 71,
        title: '무게중심 감속 부족 (Block)',
        detail: `${sm.cogDecel.mean.toFixed(2)}m/s (Driveline 엘리트 1.61m/s · Per 1mph 0.15)`,
        action: '앞다리 brace 강화, 점프 stop 드릴, 단일다리 RDL'
      });
    }
    if (sm.leadKneeExtAtBR?.mean != null && sm.leadKneeExtAtBR.mean < 0) {
      candidates.push({ kind: 'mechanic',
        weight: 72,
        title: '앞다리 신전 부족',
        detail: `${sm.leadKneeExtAtBR.mean.toFixed(0)}° (Driveline 엘리트 11° · 신전 부족 → velocity 감소)`,
        action: '앞다리 brace 드릴, 단일다리 RDL, 점프 착지 → quad 신전 훈련'
      });
    }
    if (sm.trunkForwardTilt?.mean != null && sm.trunkForwardTilt.mean < 25) {
      candidates.push({ kind: 'mechanic',
        weight: 68,
        title: '몸통 전방 기울기 부족 (BR)',
        detail: `${sm.trunkForwardTilt.mean.toFixed(0)}° (Stodden 2005, Matsuo 2001 강한 양의 상관)`,
        action: '몸통 전방 회전 드릴, hip hinge → trunk forward 훈련'
      });
    }

    // ━━ 제구 일관성 (기존 유지) ━━
    if (command != null && command < 65) {
      if (sm.fcBrMs?.cv != null && sm.fcBrMs.cv > 8) {
        candidates.push({ kind: 'command',
          weight: 65 - command + sm.fcBrMs.cv,
          title: '릴리스 타이밍 일관성',
          detail: `FC→릴리스 CV ${sm.fcBrMs.cv.toFixed(1)}% (엘리트 <2%)`,
          action: '메트로놈 투구 드릴, 동일 카운트로 릴리스 반복 훈련'
        });
      }
      if (sm.strideLength?.cv != null && sm.strideLength.cv > 5) {
        candidates.push({ kind: 'command',
          weight: 62 - command + sm.strideLength.cv,
          title: '디딤발 위치 일관성',
          detail: `스트라이드 CV ${sm.strideLength.cv.toFixed(1)}% (Drives/Fleisig 청소년 핵심 차이)`,
          action: '바닥 마커 배치 후 스트라이드 정확성 훈련, 체인 드릴'
        });
      }
      if (sm.armSlotAngle?.sd != null && sm.armSlotAngle.sd > 4) {
        candidates.push({ kind: 'command',
          weight: 60 - command + sm.armSlotAngle.sd * 2,
          title: '팔 슬롯 일관성 (downstream)',
          detail: `Arm slot SD ±${sm.armSlotAngle.sd.toFixed(2)}° (Wakamiya 2024)`,
          action: '거울 보고 동일 슬롯 반복, T-드릴, 와인드업 일관성'
        });
      }
      // ⭐ v26 — 제구 4그룹 핵심 변인 (학술 강력 예측) priority 추가
      // [A] FC 무릎 굴곡 변동성 — Manzi 2021 #2
      const kneeFcSd = sm.kneeFlexionAtFC?.sd ?? sm.frontKneeFlex?.sd;
      if (kneeFcSd != null && kneeFcSd > 5) {
        candidates.push({ kind: 'command',
          weight: 75 - command + kneeFcSd * 2,
          title: 'FC 무릎 굴곡 변동성 ⭐',
          detail: `±${kneeFcSd.toFixed(1)}° SD (Manzi 2021 정확도 #2 예측 4.2% MSE)`,
          action: '단일다리 박스 점프 착지, 와이드 스트라이드 멈춤 드릴, 동영상 셀프 피드백'
        });
      }
      // [A] FC→BR 무릎 신전 일관성 — 사용자 핵심 가설
      if (sm.leadKneeExtAtBR?.sd != null && sm.leadKneeExtAtBR.sd > 5) {
        candidates.push({ kind: 'command',
          weight: 73 - command + sm.leadKneeExtAtBR.sd * 2,
          title: 'FC→BR 무릎 신전 일관성 ⭐ (사용자 핵심 가설)',
          detail: `±${sm.leadKneeExtAtBR.sd.toFixed(1)}° SD · "굴곡→폭발적 신장" 패턴 안정성`,
          action: 'depth jump → 즉시 단일다리 brace, 메디볼 슬램 후 quad 신전 강화'
        });
      }
      // [B] 골반 회전속도 변동성 — Wang 2025 r=−0.78
      if (sm.peakPelvisVel?.cv != null && sm.peakPelvisVel.cv > 10) {
        candidates.push({ kind: 'command',
          weight: 71 - command + sm.peakPelvisVel.cv,
          title: '골반 회전 일관성 ⭐ (Wang 2025)',
          detail: `${sm.peakPelvisVel.cv.toFixed(1)}% CV · pelvic var. r=−0.78 (가장 강한 변동성 예측)`,
          action: 'pelvis dissociation 드릴, 회전 throw 변형, 케이블 Pallof press'
        });
      }
      // [C] FC 몸통 전방 기울기 변동성 — Manzi 2021 #1 (6.6% MSE)
      const trunkFcSd = sm.trunkForwardTiltAtFC?.sd ?? sm.trunkFlexAtFC?.sd;
      if (trunkFcSd != null && trunkFcSd > 4) {
        candidates.push({ kind: 'command',
          weight: 78 - command + trunkFcSd * 3,
          title: 'FC 몸통 자세 변동성 ⭐ (Manzi 2021 #1)',
          detail: `±${trunkFcSd.toFixed(1)}° SD · 정확도 1위 예측 (6.6% MSE)`,
          action: '거울 셀프 체크 + 영상 분석, FC 시점 자세 정지 드릴, 코어 stiff 강화'
        });
      }
    }
    return candidates.sort((a, b) => b.weight - a.weight).slice(0, 5);
  }
  // Mechanical Ceiling — 메카닉 점수 100 도달 시 잠재 구속
  function calcMechanicalCeiling(sm, velocityScore) {
    if (sm.velocity?.mean == null || velocityScore == null) return null;
    const currentKmh = sm.velocity.mean;
    const currentMph = currentKmh / 1.609;
    const scoreGap = Math.max(0, 100 - velocityScore);
    const potentialMphGain = Math.min(8, scoreGap / 6);
    const ceilingMph = currentMph + potentialMphGain;
    return {
      ceilingMph: r1(ceilingMph),
      ceilingKmh: r1(ceilingMph * 1.609),
      potentialMphGain: r1(potentialMphGain),
      potentialKmhGain: r1(potentialMphGain * 1.609),
      currentKmh: r1(currentKmh),
      currentMph: r1(currentMph),
      velocityScore: r0(velocityScore)
    };
  }
  function buildSummaryScores(sm, energy, physical, kineticChain, precision) {
    const velObj = calcVelocityScore(sm, energy, kineticChain, precision);
    const cmdObj = calcCommandScore(sm);
    const fitObj = calcFitnessScore(physical);
    const velocity = velObj.score;
    const command  = cmdObj.score;
    const fitness  = fitObj.score;
    // 종합 — 3축 가중 평균 (구속 40%, 제구 30%, 체력 30%)
    let overall = null;
    const validParts = [];
    if (velocity != null) validParts.push({ w: 0.40, v: velocity });
    if (command  != null) validParts.push({ w: 0.30, v: command });
    if (fitness  != null) validParts.push({ w: 0.30, v: fitness });
    if (validParts.length > 0) {
      const tw = validParts.reduce((s, p) => s + p.w, 0);
      overall = validParts.reduce((s, p) => s + p.v * p.w, 0) / tw;
    }
    const ceiling = calcMechanicalCeiling(sm, velocity);
    const priorities = generatePriorities({ velocity, command, fitness }, sm, energy, physical, kineticChain, precision);
    return {
      velocity:    { score: r0(velocity), grade: scoreToGrade(velocity), sources: velObj.sources },
      command:     { score: r0(command),  grade: scoreToGrade(command),  sources: cmdObj.sources },
      fitness:     { score: r0(fitness),  grade: scoreToGrade(fitness),  sources: fitObj.sources },
      overall:     { score: r0(overall),  grade: scoreToGrade(overall) },
      ceiling,
      priorities
    };
  }

  // ═════════════════════════════════════════════════════════════════
  // Layback 데이터
  // ═════════════════════════════════════════════════════════════════
  function buildLayback(sm) {
    const deg = sm.maxER?.mean;
    const sd  = sm.maxER?.sd;
    const band = bandFromRange(deg, REF.layback.low, REF.layback.high);
    return {
      deg: deg != null ? r1(deg) : 0,
      band,
      note: buildLaybackComment(deg, band, sd)
    };
  }

  // ═════════════════════════════════════════════════════════════════
  // 강점 / 약점 자동 생성
  // ═════════════════════════════════════════════════════════════════
  function buildStrengths(physical, summary, energy, command) {
    const out = [];
    // ─── 체력 강점 (band=high인 항목) ───
    if (physical.cmjPower?.band === 'high') {
      out.push({ title: '하체 단위파워 우수', detail: `· CMJ 단위파워 ${physical.cmjPower.cmj} W/kg · 기준 상위` });
    }
    if (physical.maxStrength?.band === 'high') {
      out.push({ title: '절대근력 우수', detail: `· IMTP ${physical.maxStrength.perKg} N/kg · 기준 상위` });
    }
    if (physical.reactive?.band === 'high') {
      out.push({ title: '반응·폭발성 (RSI) 우수', detail: `· CMJ RSI-mod ${physical.reactive.cmj} m/s · 기준 상위` });
    }
    if (physical.ssc?.band === 'high') {
      out.push({ title: '신장성 활용 (SSC) 우수', detail: `· EUR ${physical.ssc.value} · 탄성 회수 강함` });
    }
    if (physical.release?.band === 'high') {
      out.push({ title: '악력 우수', detail: `· 악력 ${physical.release.value} kg · 전완·손목 용량 충분` });
    }

    // ─── 메카닉 강점 (한국 고1 우수 기준 상회만 표시) ───
    const etiTA = summary.etiTA?.mean;
    if (etiTA != null && etiTA >= 1.7) {
      out.push({ title: '몸통→상완 에너지 전달 우수', detail: `· ETI T→A ${r2(etiTA)} · 효율적 amplification` });
    }
    const etiPT = summary.etiPT?.mean;
    if (etiPT != null && etiPT >= 1.5) {
      out.push({ title: '골반→몸통 에너지 전달 우수', detail: `· ETI P→T ${r2(etiPT)} · 키네틱 체인 시작 효율` });
    }
    const arm = summary.peakArmVel?.mean;
    if (arm != null && arm >= REF.arm.high) {
      out.push({ title: '상완 회전 속도 우수', detail: `· ${r0(arm)}°/s · 한국 고1 우수 기준 상회` });
    }
    const trunk = summary.peakTrunkVel?.mean;
    if (trunk != null && trunk >= REF.trunk.high) {
      out.push({ title: '몸통 회전 속도 우수', detail: `· ${r0(trunk)}°/s · 한국 고1 우수 기준 상회` });
    }
    const layback = summary.maxER?.mean;
    if (layback != null && layback >= REF.layback.high) {
      out.push({ title: '어깨 외회전 가동범위 우수', detail: `· Max Layback ${r1(layback)}° · 기준 상위` });
    }
    // ⭐ 신규 — 어깨 폭발력 (cocking arm power)
    const cock = summary.cockingPhaseArmPowerWPerKg?.mean;
    if (cock != null && cock >= 22) {
      out.push({ title: '어깨 폭발력 우수', detail: `· 코킹 arm power ${r1(cock)} W/kg · 폭발적 가속력` });
    }
    // ⭐ 신규 — 플라잉오픈 적정
    const flyingOpen = summary.trunkRotAtFP?.mean;
    if (flyingOpen != null && Math.abs(flyingOpen) < 5) {
      out.push({ title: '몸통 닫힘 유지 (플라잉오픈 안정)', detail: `· FC 시점 trunk rot ${r1(flyingOpen)}° · X-factor 보존` });
    }
    // ⭐ 신규 — 무릎 블록 (collapse -15~-5°)
    const kneeFC = summary.kneeFlexionAtFC?.mean;
    const kneeBR = summary.kneeFlexionAtBR?.mean;
    if (kneeFC != null && kneeBR != null) {
      const collapse = kneeFC - kneeBR;
      if (collapse >= -20 && collapse <= -5) {
        out.push({ title: '앞다리 블록 강함', detail: `· 무릎 ${r1(collapse)}° 신전 · 안정적 회전축 제공` });
      }
    }

    if (command?.overall === 'A') {
      out.push({ title: '제구 일관성 우수', detail: `· 5대 Domain 종합 A · 메카닉 일관성 안정` });
    }

    if (out.length === 0) {
      out.push({ title: '뚜렷한 우위 없음', detail: '· 모든 영역이 기준 범위 내 · 균형 보강 필요' });
    }
    return out.slice(0, 6);  // 최대 6개로 확장
  }

  function buildWeaknesses(physical, summary, energy, command) {
    const out = [];
    // ─── 메카닉 약점 ───
    const etiTA = summary.etiTA?.mean;
    if (etiTA != null && etiTA < 0.85) {
      const pct = Math.round((1 - etiTA) * 100);
      out.push({ title: '몸통→상완 에너지 누수', detail: `· ETI trunk→arm ${r2(etiTA)} · 약 ${pct}% 손실 · 기준 0.85 미만` });
    }
    const etiPT = summary.etiPT?.mean;
    if (etiPT != null && etiPT < 1.0) {
      out.push({ title: '골반→몸통 전달 부족', detail: `· ETI P→T ${r2(etiPT)} · X-factor 또는 시퀀싱 점검 필요` });
    }
    // ─── 체력 약점 (band=low) ───
    if (physical.cmjPower?.band === 'low') {
      out.push({ title: '하체 단위파워 기준 미만', detail: `· CMJ 단위파워 ${physical.cmjPower.cmj} W/kg · 기준 미만` });
    }
    if (physical.maxStrength?.band === 'low') {
      out.push({ title: '절대근력 부족', detail: `· IMTP ${physical.maxStrength.perKg} N/kg · 기준 미만` });
    }
    if (physical.reactive?.band === 'low') {
      out.push({ title: '반응성 부족', detail: `· CMJ RSI-mod ${physical.reactive.cmj} m/s · 기준 미만` });
    }
    // ─── 메카닉 약점 추가 ───
    const layback = summary.maxER?.mean;
    if (layback != null && layback < REF.layback.low) {
      out.push({ title: '어깨 외회전 가동범위 부족', detail: `· Max Layback ${r1(layback)}° · 가속 거리 부족` });
    }
    const arm = summary.peakArmVel?.mean;
    if (arm != null && arm < REF.arm.low) {
      out.push({ title: '상완 회전 속도 부족', detail: `· ${r0(arm)}°/s · 기준 ${REF.arm.low} 미만` });
    }
    const trunk = summary.peakTrunkVel?.mean;
    if (trunk != null && trunk < REF.trunk.low) {
      out.push({ title: '몸통 회전 속도 부족', detail: `· ${r0(trunk)}°/s · 기준 ${REF.trunk.low} 미만` });
    }
    // ⭐ 신규 — 플라잉오픈 (15° 이상)
    const flyingOpen = summary.trunkRotAtFP?.mean;
    if (flyingOpen != null && flyingOpen > 15) {
      out.push({ title: '플라잉오픈 (몸통 일찍 열림)', detail: `· FC 시점 trunk rot ${r1(flyingOpen)}° · X-factor 손실` });
    }
    // ⭐ 신규 — 무릎 무너짐 (collapse > +5°)
    const kneeFC = summary.kneeFlexionAtFC?.mean;
    const kneeBR = summary.kneeFlexionAtBR?.mean;
    if (kneeFC != null && kneeBR != null) {
      const collapse = kneeFC - kneeBR;
      if (collapse > 10) {
        out.push({ title: '앞다리 무릎 주저앉음', detail: `· 무릎 ${r1(collapse)}° 굴곡 증가 · 회전축 흔들림` });
      }
    }
    // ⭐ 신규 — 어깨 폭발력 부족
    const cock = summary.cockingPhaseArmPowerWPerKg?.mean;
    if (cock != null && cock < 15) {
      out.push({ title: '어깨 폭발력 부족', detail: `· 코킹 arm power ${r1(cock)} W/kg · 가속 부족` });
    }

    if (command?.overall === 'D' || command?.overall === 'C') {
      out.push({ title: '제구 일관성 부족', detail: `· 5대 Domain 종합 ${command.overall} · 메카닉 일관성 보강 필요` });
    }

    if (out.length === 0) {
      out.push({ title: '전 영역 기준 충족 · 뚜렷한 약점 없음', detail: '· 현재 수준을 유지하며 절대 근력 보강 시 추가 상승 여력' });
    }
    return out.slice(0, 6);
  }

  // ═════════════════════════════════════════════════════════════════
  // Flags 생성 (HIGH/MEDIUM/LOW severity)
  // ═════════════════════════════════════════════════════════════════
  function buildFlags(physical, summary, energy, command) {
    const flags = [];
    const etiTA = summary.etiTA?.mean;
    if (etiTA != null && etiTA < 0.85) {
      flags.push({
        severity: 'HIGH',
        title: '몸통→상완 에너지 누수',
        evidence: [`ETI trunk→arm ${r2(etiTA)} · 기준 0.85 미만`],
        implication: '· 몸통→상완 전달 손실 · lag drill 필요 · 흉추 회전 가동성 확보 · 분절 간 타이밍 재조정'
      });
    }

    const mass = physical.weightKg;
    if (physical.maxStrength?.band === 'low' && mass != null && mass < 70) {
      flags.push({
        severity: 'MEDIUM',
        title: '엔진 총량 부족 · 단위파워 양호 · 절대 용량 작음',
        evidence: [
          physical.maxStrength.abs ? `절대 근력 ${physical.maxStrength.abs} N (IMTP_F) · Low 범위` : '절대 근력 Low 범위',
          `체중 ${mass} kg`,
          physical.cmjPower?.cmj ? `CMJ 단위파워 ${physical.cmjPower.cmj} W/kg` : ''
        ].filter(Boolean),
        implication: '· 탄력·반응성 양호한 경우라도 근력·체중 총량 작으면 구속 천장 제한 · 중량 복합운동 중심 절대 근력·체중 증가 블록 우선'
      });
    }

    if (physical.cmjPower?.band === 'low' && physical.reactive?.band === 'low') {
      flags.push({
        severity: 'MEDIUM',
        title: '하체 폭발력·반응성 동반 부족',
        evidence: [
          `CMJ 단위파워 ${physical.cmjPower.cmj} W/kg`,
          physical.reactive?.cmj ? `RSI-mod ${physical.reactive.cmj} m/s` : ''
        ].filter(Boolean),
        implication: '· 점프·플라이오 + 절대 근력 동시 보강 블록 권장'
      });
    }

    if (command?.overall === 'D') {
      flags.push({
        severity: 'MEDIUM',
        title: '제구 일관성 D등급 · 메카닉 변동 큼',
        evidence: ['5개 Domain 종합 D · 시행간 변동 과다'],
        implication: '· 메카닉 일관성 회복이 최우선 · 시퀀스/타이밍 drill 위주 4-6주 블록'
      });
    }

    // ⭐ 신규 — 플라잉오픈 (15° 이상): 어깨 부담↑, 구속·제구 동시 저하
    const flyingOpen = summary.trunkRotAtFP?.mean;
    if (flyingOpen != null && flyingOpen > 15) {
      flags.push({
        severity: 'HIGH',
        title: '플라잉오픈 (몸통 일찍 열림)',
        evidence: [`FC 시점 trunk rot ${r1(flyingOpen)}° · 기준 < 5°`],
        implication: '· X-factor 손실로 회전 동력 약화 · 어깨 anterior force 증가 · open shoulder drill, mound 정렬 점검 필요'
      });
    }

    // ⭐ 신규 — 무릎 무너짐 (15° 이상): 디딤발 근력 부족
    const kneeFC = summary.kneeFlexionAtFC?.mean;
    const kneeBR = summary.kneeFlexionAtBR?.mean;
    if (kneeFC != null && kneeBR != null) {
      const collapse = kneeFC - kneeBR;
      if (collapse > 15) {
        flags.push({
          severity: 'HIGH',
          title: '앞다리 무릎 주저앉음 (knee collapse)',
          evidence: [`FC→BR 무릎 굴곡 +${r1(collapse)}° 증가 (정상: -15~-5°)`],
          implication: '· 회전축 흔들림으로 구속·제구 동시 저하 · 디딤발 근력 보강 (단발/오버헤드 스쿼트, RFE 스플릿 스쿼트) 필요'
        });
      }
    }

    // ⭐ 신규 — 어깨 폭발력 부족 (15 W/kg 미만)
    const cock = summary.cockingPhaseArmPowerWPerKg?.mean;
    if (cock != null && cock < 15) {
      flags.push({
        severity: 'MEDIUM',
        title: '어깨 폭발력 부족',
        evidence: [`코킹 arm power ${r1(cock)} W/kg · 기준 15 미만`],
        implication: '· 가속 단계 폭발력 부족 · 메디신볼 회전 던지기, 플라이오 볼 던지기, 어깨 외회전 강화 권장'
      });
    }

    // ⭐ 신규 — 팔꿈치 모멘트 위험 (130 N·m 이상): 부상 위험 신호
    const elbowTorque = summary.elbowPeakTorqueNm?.mean;
    if (elbowTorque != null && elbowTorque > 130) {
      flags.push({
        severity: 'HIGH',
        title: '팔꿈치 부하 위험 영역',
        evidence: [`Peak elbow moment ${r0(elbowTorque)} N·m · 위험 임계값 130 초과`],
        implication: '· UCL 부상 위험 ↑ · 즉시 동작 점검 필요 · 어깨 폭발력 증가 + 키네틱 체인 효율 개선으로 팔꿈치 부담 분산'
      });
    }

    return flags;
  }

  // ═════════════════════════════════════════════════════════════════
  // Training 추천 생성
  // ═════════════════════════════════════════════════════════════════
  function buildTraining(physical, summary, energy, command, factors) {
    const training = [];
    const etiTA = summary.etiTA?.mean;

    // 1) ETI 누수 → 메카닉 교정 우선
    if (etiTA != null && etiTA < 0.85) {
      training.push({
        cat: '메카닉', title: '몸통→상완 에너지 전달 개선 (셀프)', weeks: '4–6주',
        rationale: '· ETI trunk→arm 기준(0.85) 미만 · 분절 타이밍·흉추 가동성 핵심 축 · 매일 10분 수행',
        drills: [
          '수건 말아 겨드랑이 끼기 + 쉐도우 투구 30회 · 팔-몸통 분리 감각 형성',
          'Lag 드릴: 수건 끝 잡고 투구 20회 · 수건이 늦게 따라오는 느낌',
          'Open Book 흉추 모빌리티: 옆으로 누워 팔 여닫기 좌우 각 10회 × 2세트',
          '폼롤러 흉추 신전: 10회 × 2세트 (폼롤러 없으면 수건 말아서 대체)',
          '셀프 체크: 측면 셀카로 골반-어깨 분리각 유지(30–45°, 0.05초 이상) 확인'
        ]
      });
    }

    // 2) 단위파워 + 반응성 동반 부족 → 점프/플라이오
    if (physical.cmjPower?.band === 'low' || physical.reactive?.band === 'low') {
      training.push({
        cat: '파워', title: '파워 변환 (점프·플라이오 중심)', weeks: '6–8주',
        rationale: '· 절대 근력 양호한 편이나 폭발적 발현력 부족 · 점프·탄성 드릴로 RSI 개선',
        drills: [
          '뎁스 점프 (낮은 계단 30cm) 3세트 × 5회 · 땅 닿자마자 바로 점프',
          '회전 메디볼 던지기 (3–5kg) 좌우 각 4세트 × 6회 · 벽 대고 가능',
          '스플릿 점프 스쿼트 (자중·덤벨 선택) 3세트 × 6회 좌우 · 파워 변환 훈련',
          '브로드 점프 3세트 × 5회 · 매주 거리 기록',
          '셀프 체크: 점프 높이/거리가 4주 내 5–10% 증가하면 파워 변환 진행 중'
        ]
      });
    }

    // 3) 절대 근력 부족 → 근력·체중 증가 블록
    const mass = physical.weightKg;
    if (physical.maxStrength?.band === 'low' || (mass != null && mass < 70)) {
      training.push({
        cat: '근력', title: '근력·체중 증가 블록', weeks: '8–12주',
        rationale: '· 절대 근력/체중 작음 · 식단과 자중·덤벨 훈련 병행',
        drills: [
          '고블릿 스쿼트 (덤벨·배낭에 짐 넣어 대체 가능) 4세트 × 8–10회 · 주 2회',
          '불가리안 스플릿 스쿼트 3세트 × 8회 좌우 · 하체 근비대',
          '푸시업 (가중 옵션: 배낭) 4세트 × 최대 반복',
          '풀업/로우: 철봉 풀업 or 인버티드 로우',
          '식단: 하루 단백질 체중 1kg당 1.6–2.0g · 0.25–0.5 kg/주 체중 증가 목표',
          '셀프 체크: 매주 같은 요일·시간 체중 측정 · 사진 기록'
        ]
      });
    }

    // 4) 단위파워 우수 + 근력 보통 → 근력 보강 (단위파워 유지)
    if (physical.cmjPower?.band === 'high' && physical.maxStrength?.band !== 'high' && physical.maxStrength?.band !== 'na') {
      training.push({
        cat: '근력', title: '근력 보강 (단위파워 유지)', weeks: '6–8주',
        rationale: '· 단위파워 이미 우수 · 절대 근력 증가 시 파워 총량 동반 상승',
        drills: [
          '고블릿 스쿼트 (덤벨 1개) 4세트 × 6–8회 · 주 2회',
          '싱글 레그 루마니안 데드리프트 (덤벨) 3세트 × 8회',
          '스텝업 (의자·벤치) 3세트 × 10회 좌우 교대',
          '푸시업 변형 4세트 × 15회',
          '셀프 체크: 각 세트 후 자세 확인 · 무릎 안쪽 무너짐 없는지'
        ]
      });
    }

    // 5) 7대 요인 D등급 → 동작 교정 드릴
    if (Array.isArray(factors)) {
      const dFactors = factors.filter(f => f.grade === 'D');
      if (dFactors.length > 0) {
        const drillMap = {
          'F1_landing': { what: '앞발 착지 위치 일정화', how: '거울 앞 미러링 + foot strike marker로 매 투구 같은 위치에 착지하도록 반복' },
          'F2_separation': { what: '골반-몸통 분리 일관성', how: 'Hip Hinge Drill + Late Trunk Rotation cue (의식적으로 몸통 회전 늦추기)' },
          'F3_arm_timing': { what: '어깨-팔 타이밍 일관화', how: 'Connection Ball drill + Plyo Ball으로 팔 동작 패턴 자동화 (주 3회)' },
          'F4_knee': { what: '앞 무릎 안정성 (blocking) 회복', how: 'Single-Leg RDL + Single-Leg Squat + 앞다리 등척성 홀드 (주 2-3회)' },
          'F5_tilt': { what: '몸통 기울기 일관성', how: '코어 안정성 강화 + Side Plank, Rotational Core 운동 (주 3회)' },
          'F6_head': { what: '머리·시선 안정성 회복', how: 'Mirror Drill + 시선 고정 투구 + 호흡 통제' },
          'F7_wrist': { what: '손목 정렬 일관성', how: 'Towel Drill + 슬로우 모션 릴리스 반복 + 그립 일정화' }
        };
        dFactors.slice(0, 2).forEach(f => {
          const d = drillMap[f.id];
          if (d) {
            training.push({
              cat: '제구', title: d.what, weeks: '4–6주',
              rationale: `· ${f.name} D등급 · 시행간 변동 큼 · 메카닉 일관성 회복 우선`,
              drills: [
                d.how,
                '비디오 셀프 피드백 (측면 + 후면) 매 세션 기록',
                '주 3회 · 30분 · 무게 가벼운 공으로 반복',
                '셀프 체크: 4주 내 SD 50% 감소 목표'
              ]
            });
          }
        });
      }
    }

    // 6) 약점 없음 → 유지/발전 처방
    if (training.length === 0) {
      training.push({
        cat: '유지', title: '현재 수준 유지 + 균형 발전', weeks: '8–12주',
        rationale: '· 모든 영역 기준 충족 · 약점 없음 · 절대 근력 보강 시 추가 상승 여력',
        drills: [
          '주 2회 근력 운동 (스쿼트·데드리프트·벤치)',
          '주 3회 플라이오메트릭 + 메디볼',
          '주 1회 모빌리티/리커버리 세션',
          '체중 유지 (단백질 1.6g/kg)',
          '월 1회 영상 분석으로 일관성 모니터링'
        ]
      });
    }

    return training.slice(0, 4);
  }

  // ═════════════════════════════════════════════════════════════════
  // 메인 빌더
  // ═════════════════════════════════════════════════════════════════
  function build({ profile, velocity, bio, physical }) {
    if (!bio) {
      return { error: 'BBLAnalysis 결과가 없습니다' };
    }
    const sm = bio.summary || {};
    const fallbackDate = new Date().toISOString().slice(0, 10);

    // 기본 정보
    const base = {
      id: profile.id || `pitcher_${Date.now()}`,
      name: profile.name || '선수',
      nameEn: profile.nameEn || '',
      age: profile.age,
      bmi: profile.bmi,
      videoUrl: profile.videoUrl || null,
      velocity: velocity.max != null ? parseFloat(velocity.max) : (sm.velocity?.max || 0),
      velocityAvg: velocity.avg != null ? parseFloat(velocity.avg) : (sm.velocity?.mean || 0),
      spinRate: velocity.spinRate != null ? parseFloat(velocity.spinRate) : null,
      date: profile.date || fallbackDate
    };

    // 체력 데이터 통합 (heightCm, weightKg는 profile 우선)
    const phys = {
      ...physical,
      weightKg: profile.weightKg ? parseFloat(profile.weightKg) : physical.weightKg,
      heightCm: profile.heightCm ? parseFloat(profile.heightCm) : null
    };

    // ⭐ v23 — 의존성 순서: 컴포넌트 먼저 빌드 → archetype/coreInfo 판정 → summaryScores
    // 5개 컴포넌트 구성
    const radar = buildRadar(phys);
    const sequence = buildSequence(sm, bio.sequencing);
    const angular  = buildAngular(sm);
    const energy   = buildEnergy(sm, bio.energy);
    const layback  = buildLayback(sm);
    const command  = buildCommand(bio.command, sm);
    const factors  = buildFactors(bio.factors, sm, bio.faultRates);
    const precision = buildPrecision(sm);

    // 신규 — Section 05/06/D/E 데이터
    const kineticChain  = buildKineticChain(sm);
    const velocityRadar = buildVelocityRadar(sm, bio.energy, kineticChain, precision);
    const consistency   = buildConsistency(sm, bio.command);

    // Archetype/CoreIssue/Severity (kineticChain·precision 활용)
    const archetypeInfo = classifyArchetype(phys, sm, bio.energy, kineticChain, precision);
    const coreInfo = classifyCoreIssue(phys, sm, bio.energy, bio.command, kineticChain, precision);
    const tags = buildTags(phys);

    const summaryScores = buildSummaryScores(sm, bio.energy, phys, kineticChain, precision);

    // ⭐ v25 — 리포트 구조 재구성용 v24 7그룹 변인 객체
    //   각 그룹의 변인을 dashboard에서 sub-panel로 표시
    //   값이 null인 변인은 BBLAnalysis가 산출하지 못한 것 (sm.* 미존재)
    const mechanics = {
      // [A] 키네틱 체인 (가중치 0.30) — 사용자 강조
      kinetic: {
        etiPT: sm.etiPT?.mean ?? null,
        etiTA: sm.etiTA?.mean ?? null,
        leakPct: bio.energy?.leakPct ?? null,
        ptLagMs: sm.ptLagMs?.mean ?? null,
        taLagMs: sm.taLagMs?.mean ?? null,
        // v23 호환: pelvisMs, trunkMs, armMs도 함께 (시퀀싱 차트용)
        sequence: { pelvisMs: 0, trunkMs: sm.ptLagMs?.mean ?? null,
                    armMs: (sm.ptLagMs?.mean ?? 0) + (sm.taLagMs?.mean ?? 0) }
      },
      // [B] Arm Action (가중치 0.18) — 드라이브라인 #2
      armAction: {
        layback: sm.maxER?.mean ?? null,
        shoulderAbdFP: sm.shoulderAbdFP?.mean ?? sm.shoulderAbductionFP?.mean ?? null,
        scapLoadFP: sm.scapLoadFP?.mean ?? sm.scapulaLoadFP?.mean ?? sm.scapLoad?.mean ?? null
      },
      // [C] Posture (가중치 0.18) — 드라이브라인 #1 (영향력 1위)
      posture: {
        hipShoulderSep: sm.hipShoulderSep?.mean ?? sm.hipShoulderSepFP?.mean ?? sm.maxXFactor?.mean ?? null,
        trunkFwdTiltFP: sm.torsoFwdTiltFP?.mean ?? sm.trunkFwdTiltFP?.mean ?? sm.trunkForwardTiltAtFC?.mean ?? null,
        counterRot: sm.peakTorsoCounterRot?.mean ?? sm.torsoCounterRot?.mean ?? null,
        trunkRotFP: sm.torsoRotFP?.mean ?? sm.trunkRotFP?.mean ?? sm.trunkRotAtFP?.mean ?? null
      },
      // [D] Rotation (가중치 0.10) — 드라이브라인 #3
      rotation: {
        trunkRotVel: sm.peakTrunkVel?.mean ?? null
      },
      // [E] Block (가중치 0.09) — 드라이브라인 #5
      block: {
        leadKneeExtBR: sm.leadKneeExtAtBR?.mean ?? null,
        strideRatio: sm.strideRatio?.mean ?? null
      },
      // [F] CoG (가중치 0.05) — 드라이브라인 #4 (영향력 4위)
      cog: {
        cogDecel: sm.cogDecel?.mean ?? null
      },
      // [G] 절대 KE/Power (가중치 0.10) — 학술 + 4명 검증
      power: {
        peakPowerArm: kineticChain?.peakPowerArm ?? null,
        keArm: kineticChain?.KE_arm?.val ?? null,
        cockPowerWPerKg: precision?.cockPowerWPerKg ?? null
      }
    };

    // ⭐ v26 — 제구 점수 4그룹 변인 객체 (Section 03 카테고리화 시각화)
    //   사용자 가설: 근본 원인 (착지 + 회전 타이밍) + 결과 (릴리즈)
    //   학술 근거: Manzi 2019/2021, Wang 2025, Howenstein 2021, Wakamiya 2024
    const commandV26 = {
      // [A] 앞발 착지 안정성 (사용자 강조 — 근본 원인) — 0.40
      landing: {
        strideLengthCv:  sm.strideLength?.cv ?? null,
        kneeFcSd:        sm.kneeFlexionAtFC?.sd ?? sm.frontKneeFlex?.sd ?? null,
        kneeBrSd:        sm.kneeFlexionAtBR?.sd ?? null,
        leadKneeExtSd:   sm.leadKneeExtAtBR?.sd ?? null,
        strideLengthMean:sm.strideLength?.mean ?? null,
        kneeFcMean:      sm.kneeFlexionAtFC?.mean ?? sm.frontKneeFlex?.mean ?? null,
        kneeBrMean:      sm.kneeFlexionAtBR?.mean ?? null,
        leadKneeExtMean: sm.leadKneeExtAtBR?.mean ?? null
      },
      // [B] 회전 타이밍 (사용자 강조 + Wang 2025 r=−0.78) — 0.30
      rotation: {
        ptLagCv:        sm.ptLagMs?.cv ?? null,
        taLagCv:        sm.taLagMs?.cv ?? null,
        pelvisVelCv:    sm.peakPelvisVel?.cv ?? null,
        trunkVelCv:     sm.peakTrunkVel?.cv ?? null,
        ptLagMean:      sm.ptLagMs?.mean ?? null,
        taLagMean:      sm.taLagMs?.mean ?? null,
        pelvisVelMean:  sm.peakPelvisVel?.mean ?? null,
        trunkVelMean:   sm.peakTrunkVel?.mean ?? null
      },
      // [C] 자세 일관성 (Manzi 2021 6.6% MSE) — 0.18
      posture: {
        trunkFcSd:      sm.trunkForwardTiltAtFC?.sd ?? sm.trunkFlexAtFC?.sd ?? null,
        trunkRotFcSd:   sm.trunkRotAtFP?.sd ?? null,
        trunkFcMean:    sm.trunkForwardTiltAtFC?.mean ?? sm.trunkFlexAtFC?.mean ?? null,
        trunkRotFcMean: sm.trunkRotAtFP?.mean ?? null
      },
      // [D] 릴리즈 결과 (downstream — 사용자: 결과 지표) — 0.12
      release: {
        armSlotSd:      sm.armSlotAngle?.sd ?? null,
        wristSdCm:      sm.wristHeight?.sd != null ? sm.wristHeight.sd * 100 : null,
        fcBrCv:         sm.fcBrMs?.cv ?? null,
        armSlotMean:    sm.armSlotAngle?.mean ?? null,
        wristMean:      sm.wristHeight?.mean ?? null,
        fcBrMean:       sm.fcBrMs?.mean ?? null
      }
    };

    // 강점/약점/플래그 (트레이닝/드릴은 비활성화 — 빈 배열)
    const strengths  = buildStrengths(phys, sm, bio.energy, bio.command);
    const weaknesses = buildWeaknesses(phys, sm, bio.energy, bio.command);
    const flags      = buildFlags(phys, sm, bio.energy, bio.command);
    const training   = [];  // 사용자 요청에 따라 트레이닝 섹션 제거

    return {
      ...base,
      archetype: archetypeInfo.archetype,
      archetypeEn: archetypeInfo.archetypeEn,
      tags,
      coreIssue: coreInfo.coreIssue,
      coreIssueEn: coreInfo.coreIssueEn,
      severity: coreInfo.severity,
      physical: phys,
      radar,
      sequence,
      angular,
      energy,
      layback,
      command,
      factors,
      precision,
      kineticChain,    // Section 05 — KE/Power/Transfer/Elbow
      mechanics,       // ⭐ v25 — Section 02 v24 7그룹 변인 정리
      commandV26,      // ⭐ v26 — Section 03 제구 4그룹 변인 정리
      velocityRadar,   // Section 06 — 7축 구속 종합 레이더
      consistency,     // Section D  — 5영역 일관성 카드
      summaryScores,   // Section E  — 종합 점수 + 우선순위
      strengths,
      weaknesses,
      flags,
      training,
      _rawBio: bio,
      _rawPhysical: physical
    };
  }

  window.BBLDataBuilder = { build, REF };
})();
