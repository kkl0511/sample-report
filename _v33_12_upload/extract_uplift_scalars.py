"""
extract_uplift_scalars.py — BBL Uplift trial CSV → Phase 2/3 변수 산출
app.js extractScalarsFromUplift (line 529~1421) 1:1 Python 포팅.
변경 시 양쪽 동시 (메모리: feedback_phase2_134_cohort_processing.md).

입력: Uplift Capture trial CSV
출력: dict (Phase 2 18 + Phase 3 7 = 25 변수 + 메타)

Author: Theia 비교 분석 세션 (2026-05-05) — v33.9 산식 포팅
"""

import pandas as pd
import numpy as np
import math
from datetime import datetime
import re

# ── 좌투 좌표 정규화 상수 (app.js line 105-108) ──
LEFT_TRUNK_REF = 174
LEFT_PELVIS_REF = 152
LEFT_TO_RIGHT_TRUNK_OFFSET = 241
LEFT_TO_RIGHT_PELVIS_OFFSET = 200


def normalize_angle(angle, ref):
    """app.js line 101-104. circular normalize for wrap-around."""
    if angle is None or pd.isna(angle):
        return None
    return ((angle - ref + 180) % 360) - 180 + ref


def safe_num(v):
    try:
        f = float(v)
        if math.isnan(f):
            return None
        return f
    except (ValueError, TypeError):
        return None


def session_folder_from(athlete_name, capture_time):
    """app.js line 545-559. 'jeongyejun_20251024' 형식."""
    if not athlete_name:
        return None
    id_str = re.sub(r'^s\d+\s+', '', str(athlete_name).lower(), flags=re.I).strip()
    date_str = ''
    cap = str(capture_time)
    if re.match(r'^\d{10,}$', cap):
        ts = int(cap)
        if ts < 1e12:
            ts *= 1
        d = datetime.fromtimestamp(ts if ts < 1e10 else ts/1000)
        date_str = d.strftime('%Y%m%d')
    else:
        m = re.search(r'(\d{4})[-/.]?(\d{2})[-/.]?(\d{2})', cap)
        if m:
            date_str = m.group(1) + m.group(2) + m.group(3)
    if id_str and date_str:
        return f"{id_str}_{date_str}"
    return None


# ──────────────────────────────────────────────────────────
# 헬퍼: frame 기반 시계열 접근
# ──────────────────────────────────────────────────────────

class TrialData:
    """frame_map + DataFrame 통합 접근."""
    def __init__(self, df):
        self.df = df
        self.cols = set(df.columns)
        # frame → DataFrame index
        if 'frame' in df.columns:
            f = df['frame'].astype('Int64')
            self.frame_to_row = {int(v): i for i, v in enumerate(f) if pd.notna(v)}
        else:
            self.frame_to_row = {}
        self.n = len(df)

    def has(self, col):
        return col in self.cols

    def val_at(self, frame, col):
        """app.js valAt: 특정 frame에서의 col 값."""
        if frame is None or col not in self.cols:
            return None
        ri = self.frame_to_row.get(int(frame))
        if ri is None:
            return None
        v = self.df.iloc[ri][col]
        return safe_num(v)

    def _row_range(self, from_f, to_f):
        if from_f is None or to_f is None:
            return None, None
        lo, hi = (from_f, to_f) if from_f <= to_f else (to_f, from_f)
        # frame range를 row range로 변환
        ri_lo = self.frame_to_row.get(int(lo))
        ri_hi = self.frame_to_row.get(int(hi))
        if ri_lo is None or ri_hi is None:
            # fallback: 가장 가까운 frame 찾기
            frames = sorted(self.frame_to_row.keys())
            ri_lo = self.frame_to_row[next((f for f in frames if f >= lo), frames[-1])]
            ri_hi = self.frame_to_row[next((f for f in reversed(frames) if f <= hi), frames[0])]
        return min(ri_lo, ri_hi), max(ri_lo, ri_hi)

    def col_max_between(self, col, from_f, to_f):
        if col not in self.cols:
            return None
        ri_lo, ri_hi = self._row_range(from_f, to_f)
        if ri_lo is None:
            return None
        s = self.df.iloc[ri_lo:ri_hi+1][col].apply(safe_num).dropna()
        return float(s.max()) if len(s) else None

    def col_min_between(self, col, from_f, to_f):
        if col not in self.cols:
            return None
        ri_lo, ri_hi = self._row_range(from_f, to_f)
        if ri_lo is None:
            return None
        s = self.df.iloc[ri_lo:ri_hi+1][col].apply(safe_num).dropna()
        return float(s.min()) if len(s) else None

    def col_max_abs_between(self, col, from_f, to_f):
        if col not in self.cols:
            return None
        ri_lo, ri_hi = self._row_range(from_f, to_f)
        if ri_lo is None:
            return None
        s = self.df.iloc[ri_lo:ri_hi+1][col].apply(safe_num).dropna()
        if len(s) == 0:
            return None
        return float(s.abs().max())

    def col_diff_signed_max_between(self, col_a, col_b, from_f, to_f):
        """A - B의 signed max. app.js line 841-855."""
        if col_a not in self.cols or col_b not in self.cols:
            return None
        ri_lo, ri_hi = self._row_range(from_f, to_f)
        if ri_lo is None:
            return None
        sub = self.df.iloc[ri_lo:ri_hi+1]
        a = sub[col_a].apply(safe_num)
        b = sub[col_b].apply(safe_num)
        d = (a - b).dropna()
        return float(d.max()) if len(d) else None

    def arg_extreme(self, col, from_row, to_row, mode):
        """app.js _argExtreme. row 기반. mode in {'max','min','absMax'}."""
        if col not in self.cols:
            return None
        lo = max(0, from_row)
        hi = min(self.n - 1, to_row)
        if lo > hi:
            return None
        sub = self.df.iloc[lo:hi+1][col].apply(safe_num).dropna()
        if len(sub) == 0:
            return None
        if mode == 'min':
            row_idx = sub.idxmin()
        elif mode == 'absMax':
            row_idx = sub.abs().idxmax()
        else:  # max
            row_idx = sub.idxmax()
        # row index → frame
        f = safe_num(self.df.iloc[row_idx]['frame']) if 'frame' in self.cols else None
        return int(f) if f is not None else None


# ──────────────────────────────────────────────────────────
# 이벤트 검출 (KH / FC / BR / MER) — app.js line 595-688
# ──────────────────────────────────────────────────────────

def get_frame_abs(td, col, cur0):
    """app.js line 569-574. Uplift offset → 절대 frame."""
    if col not in td.cols:
        return None
    v = safe_num(td.df.iloc[0][col])
    if v is None or v == 0:
        return None
    return cur0 - v


def detect_kh(td, front_side, total_frames):
    return td.arg_extreme(f'{front_side}_knee_jc_3d_y', 0, int(total_frames * 0.6), 'max')


def detect_fc(td, kh_frame, front_side):
    if kh_frame is None:
        return None
    kh_row = td.frame_to_row.get(int(kh_frame))
    if kh_row is None:
        return None
    return td.arg_extreme(f'{front_side}_ankle_jc_3d_y', kh_row + 30, kh_row + 200, 'min')


def detect_mer(td, fc_frame, br_frame, arm_side):
    if fc_frame is None:
        return None
    fc_row = td.frame_to_row.get(int(fc_frame))
    if fc_row is None:
        return None
    br_row = td.frame_to_row.get(int(br_frame)) if br_frame is not None else None
    hi = br_row if br_row is not None else fc_row + 30
    return td.arg_extreme(f'{arm_side}_shoulder_external_rotation', fc_row, hi, 'absMax')


def detect_br(td, fc_frame):
    """양 팔 비교 후 큰 쪽 시점."""
    if fc_frame is None:
        return None
    fc_row = td.frame_to_row.get(int(fc_frame))
    if fc_row is None:
        return None
    l_arm_f = td.arg_extreme('left_arm_rotational_velocity_with_respect_to_ground', fc_row+5, fc_row+50, 'absMax')
    r_arm_f = td.arg_extreme('right_arm_rotational_velocity_with_respect_to_ground', fc_row+5, fc_row+50, 'absMax')
    l_val = abs(td.val_at(l_arm_f, 'left_arm_rotational_velocity_with_respect_to_ground') or 0)
    r_val = abs(td.val_at(r_arm_f, 'right_arm_rotational_velocity_with_respect_to_ground') or 0)
    return l_arm_f if l_val >= r_val else r_arm_f


def detect_peak_rot_vel(td, col, from_f, to_f):
    """app.js line 662-674. fallback: from_f + 200 frames."""
    from_row = td.frame_to_row.get(int(from_f)) if from_f is not None else 0
    if to_f is not None:
        to_row = td.frame_to_row.get(int(to_f))
    elif from_row is not None:
        to_row = min(from_row + 200, td.n - 1)
    else:
        to_row = td.n - 1
    if from_row is None:
        from_row = 0
    if to_row is None:
        to_row = td.n - 1
    return td.arg_extreme(col, from_row, to_row, 'absMax')


# ──────────────────────────────────────────────────────────
# 메인 산출 함수
# ──────────────────────────────────────────────────────────

def extract_scalars(csv_path):
    """단일 trial CSV → scalar dict."""
    try:
        df = pd.read_csv(csv_path, encoding='utf-8-sig')
    except Exception as e:
        return {'_error': f'read_csv: {e}', '_path': str(csv_path)}

    if len(df) == 0:
        return {'_error': 'empty', '_path': str(csv_path)}

    td = TrialData(df)

    # 메타
    r0 = df.iloc[0]
    athlete_name = r0.get('athlete_name', '') or ''
    capture_time = r0.get('capture_time', r0.get('capture_datetime', ''))
    fps = safe_num(r0.get('fps', 240)) or 240
    handedness = str(r0.get('handedness', '') or '').lower()
    arm_side = 'left' if handedness == 'left' else 'right'
    front_side = 'right' if arm_side == 'left' else 'left'
    drive_side = arm_side  # drive leg = throwing arm side
    cur0 = safe_num(r0.get('frame', 0)) or 0
    total_frames = td.n

    # ─── 이벤트: Uplift 우선 ───
    up_kh = get_frame_abs(td, 'max_knee_raise_frame', cur0)
    up_fc = get_frame_abs(td, 'foot_contact_frame', cur0)
    up_br = get_frame_abs(td, 'ball_release_frame', cur0)
    up_mer = get_frame_abs(td, 'max_external_rotation_frame', cur0)
    up_peak_pelvis = (get_frame_abs(td, 'peak_pelvis_angular_velocity_frame', cur0)
                      or get_frame_abs(td, 'max_pelvis_rotational_velocity_with_respect_to_ground_frame', cur0))
    up_peak_trunk = (get_frame_abs(td, 'peak_trunk_angular_velocity_frame', cur0)
                     or get_frame_abs(td, 'max_trunk_rotational_velocity_with_respect_to_ground_frame', cur0))
    up_peak_arm = (get_frame_abs(td, 'peak_arm_angular_velocity_frame', cur0)
                   or get_frame_abs(td, f'max_{arm_side}_arm_rotational_velocity_with_respect_to_ground_frame', cur0))

    # raw fallback
    raw_kh = detect_kh(td, front_side, total_frames)
    raw_fc = detect_fc(td, raw_kh, front_side)
    raw_br = detect_br(td, raw_fc)
    raw_mer = detect_mer(td, raw_fc, raw_br, arm_side)

    events = {
        'kh': up_kh if up_kh is not None else raw_kh,
        'fc': up_fc if up_fc is not None else raw_fc,
        'br': up_br if up_br is not None else raw_br,
        'mer': up_mer if up_mer is not None else raw_mer,
    }

    # peak frames — [v33.10] Uplift 사전 peak frame 무시. signal-based windowed detection만 사용.
    #   Theia 비교 결과: Uplift 사전 *_angular_velocity_frame은 BBL과 다른 알고리즘으로 산출됨.
    #   signal-based만 사용 시 lag mean diff 30→6ms 개선 검증됨.
    pelvis_lo = raw_kh if raw_kh is not None else events['fc']
    pelvis_hi = events['mer'] if events['mer'] is not None else (events['br'] if events['br'] is not None else raw_br)
    events['peakPelvis'] = detect_peak_rot_vel(
        td, 'pelvis_rotational_velocity_with_respect_to_ground', pelvis_lo, pelvis_hi)

    trunk_lo = events['fc'] if events['fc'] is not None else raw_fc
    trunk_hi = (events['mer'] + 10) if events['mer'] is not None else (events['br'] if events['br'] is not None else raw_br)
    events['peakTrunk'] = detect_peak_rot_vel(
        td, 'trunk_rotational_velocity_with_respect_to_ground', trunk_lo, trunk_hi)

    # arm peak: throwing arm 자동 + signal-based detection (v33.10 Uplift 사전 frame 무시)
    arm_lo = (events['mer'] + 3) if events['mer'] is not None else (events['fc'] if events['fc'] is not None else raw_fc)
    arm_hi = (events['br'] + 10) if events['br'] is not None else raw_br
    def max_abs_in(col, lo, hi):
        return td.col_max_abs_between(col, lo, hi) or 0
    l_max = max_abs_in('left_arm_rotational_velocity_with_respect_to_ground', arm_lo, arm_hi)
    r_max = max_abs_in('right_arm_rotational_velocity_with_respect_to_ground', arm_lo, arm_hi)
    col = 'left_arm_rotational_velocity_with_respect_to_ground' if l_max >= r_max else 'right_arm_rotational_velocity_with_respect_to_ground'
    events['peakArm'] = detect_peak_rot_vel(td, col, arm_lo, arm_hi)

    # throwing arm 자동 검출 (양 팔 max abs 비교)
    win_from = events['kh'] if events['kh'] is not None else (events['fc'] - 100 if events['fc'] is not None else None)
    win_to = (events['br'] + 30) if events['br'] is not None else None
    if win_from is not None and win_to is not None:
        l_av = td.col_max_abs_between('left_arm_rotational_velocity_with_respect_to_ground', win_from, win_to) or 0
        r_av = td.col_max_abs_between('right_arm_rotational_velocity_with_respect_to_ground', win_from, win_to) or 0
        # ★ v33.1: 양쪽 0 케이스 보호 — handedness 라벨 신뢰
        if l_av == 0 and r_av == 0:
            throwing_arm_detected = arm_side
        else:
            throwing_arm_detected = 'left' if l_av > r_av else 'right'
    else:
        throwing_arm_detected = arm_side

    out = {
        'athlete_name': athlete_name,
        'capture_time': capture_time,
        'fps': fps,
        'handedness': handedness,
        'arm_side': arm_side,
        'throwing_arm_detected': throwing_arm_detected,
        'session_folder': session_folder_from(athlete_name, capture_time),
        'events': dict(events),
        '_csv_path': str(csv_path),
    }

    # ════════════════════════════════════════════════════════════
    # Phase 2 변수
    # ════════════════════════════════════════════════════════════

    # peak_pelvis/trunk/arm_av — windowed abs max
    if win_from is not None and win_to is not None:
        out['peak_pelvis_av'] = td.col_max_abs_between(
            'pelvis_rotational_velocity_with_respect_to_ground', win_from, win_to)
        out['peak_trunk_av'] = td.col_max_abs_between(
            'trunk_rotational_velocity_with_respect_to_ground', win_from, win_to)
        l_av = td.col_max_abs_between('left_arm_rotational_velocity_with_respect_to_ground', win_from, win_to) or 0
        r_av = td.col_max_abs_between('right_arm_rotational_velocity_with_respect_to_ground', win_from, win_to) or 0
        out['peak_arm_av'] = max(l_av, r_av) if (l_av or r_av) else None

        if out.get('peak_trunk_av') and out['peak_trunk_av'] > 0 and out.get('peak_arm_av'):
            out['arm_trunk_speedup'] = out['peak_arm_av'] / out['peak_trunk_av']
        if out.get('peak_pelvis_av') and out['peak_pelvis_av'] > 0 and out.get('peak_trunk_av'):
            out['pelvis_trunk_speedup'] = out['peak_trunk_av'] / out['peak_pelvis_av']

    # max_x_factor — signed max [KH, FC+5]
    if events['kh'] is not None and events['fc'] is not None:
        if arm_side == 'left':
            xf = td.col_diff_signed_max_between('trunk_global_rotation', 'pelvis_global_rotation',
                                                 events['kh'], events['fc'] + 5)
        else:
            xf = td.col_diff_signed_max_between('pelvis_global_rotation', 'trunk_global_rotation',
                                                 events['kh'], events['fc'] + 5)
        if xf is not None:
            out['max_x_factor'] = xf

    # lag_ms
    if events['peakPelvis'] is not None and events['peakTrunk'] is not None:
        out['pelvis_to_trunk_lag_ms'] = (events['peakTrunk'] - events['peakPelvis']) / fps * 1000
    if events['peakTrunk'] is not None and events['peakArm'] is not None:
        out['trunk_to_arm_lag_ms'] = (events['peakArm'] - events['peakTrunk']) / fps * 1000

    # stride_time_ms
    if events['kh'] is not None and events['fc'] is not None:
        out['stride_time_ms'] = (events['fc'] - events['kh']) / fps * 1000

    # drive_hip_ext_vel_max
    if events['kh'] is not None and events['fc'] is not None:
        col = f'{drive_side}_hip_flexion_velocity_with_respect_to_trunk'
        mn = td.col_min_between(col, events['kh'], events['fc'])
        if mn is not None and mn < 0:
            out['drive_hip_ext_vel_max'] = -mn

    # lead_hip_flex_at_fc
    if events['fc'] is not None:
        out['lead_hip_flex_at_fc'] = td.val_at(events['fc'], f'{front_side}_hip_flexion_with_respect_to_trunk')

    # lead_hip_ext_vel_max
    if events['fc'] is not None and events['br'] is not None:
        col = f'{front_side}_hip_flexion_velocity_with_respect_to_trunk'
        mn = td.col_min_between(col, events['fc'], events['br'])
        if mn is not None and mn < 0:
            out['lead_hip_ext_vel_max'] = -mn

    # proper_sequence_binary
    pp, pt, pa = events['peakPelvis'], events['peakTrunk'], events['peakArm']
    if pp is not None and pt is not None and pa is not None:
        out['proper_sequence_binary'] = 1 if (pp < pt < pa) else 0

    # FC at-event (좌투 좌표 정규화)
    if events['fc'] is not None:
        trunk_rot = td.val_at(events['fc'], 'trunk_global_rotation')
        pelvis_rot = td.val_at(events['fc'], 'pelvis_global_rotation')
        if arm_side == 'left':
            trunk_rot = normalize_angle(trunk_rot, LEFT_TRUNK_REF)
            pelvis_rot = normalize_angle(pelvis_rot, LEFT_PELVIS_REF)
            if trunk_rot is not None:
                trunk_rot -= LEFT_TO_RIGHT_TRUNK_OFFSET
            if pelvis_rot is not None:
                pelvis_rot -= LEFT_TO_RIGHT_PELVIS_OFFSET
        out['trunk_rotation_at_fc'] = trunk_rot
        if trunk_rot is not None and pelvis_rot is not None:
            out['hip_shoulder_sep_at_fc'] = pelvis_rot - trunk_rot
        # trunk_forward_tilt_at_fc: [v33.10] 좌·우투 wrap-around to [-180,180] 후 |flex|
        #   Theia 비교 결과: 우투수에서도 wrap-around 미처리로 outlier 발생. mean diff 86°→3° 검증.
        up_flex = td.val_at(events['fc'], 'trunk_global_flexion')
        if up_flex is not None:
            up_flex = ((up_flex + 180) % 360 + 360) % 360 - 180  # wrap to [-180, 180]
            out['trunk_forward_tilt_at_fc'] = 180 - abs(up_flex)
        # shoulder_h_abd_at_fc
        h_col = f'{arm_side}_shoulder_horizontal_adduction'
        habd = td.val_at(events['fc'], h_col)
        if habd is not None:
            out['shoulder_h_abd_at_fc'] = -habd

    # lead_knee_ext_vel_max + change
    if events['fc'] is not None and events['br'] is not None:
        out['lead_knee_ext_vel_max'] = td.col_max_between(
            f'{front_side}_knee_extension_velocity', events['fc'], events['br'])
        knee_col = f'{front_side}_knee_extension'
        kfc = td.val_at(events['fc'], knee_col)
        kbr = td.val_at(events['br'], knee_col)
        if kfc is not None and kbr is not None:
            out['lead_knee_ext_change_fc_to_br'] = kbr - kfc

    # trunk_flex_vel_max — 1차 미분 max [FC-30, BR+30]
    if events['fc'] is not None and events['br'] is not None and 'trunk_global_flexion' in td.cols:
        lo = max(0, events['fc'] - 30)
        hi = events['br'] + 30
        ri_lo, ri_hi = td._row_range(lo, hi)
        if ri_lo is not None:
            sub = td.df.iloc[ri_lo:ri_hi+1]
            vals = sub['trunk_global_flexion'].apply(safe_num).reset_index(drop=True)
            frames = sub['frame'].apply(safe_num).reset_index(drop=True)
            dt = 1 / fps
            max_abs_vel = None
            prev_v, prev_f = None, None
            for v, f in zip(vals, frames):
                if v is None or pd.isna(v):
                    prev_v = None
                    continue
                if prev_v is not None and prev_f is not None and f > prev_f:
                    vel = abs(v - prev_v) / ((f - prev_f) * dt)
                    if max_abs_vel is None or vel > max_abs_vel:
                        max_abs_vel = vel
                prev_v, prev_f = v, f
            if max_abs_vel is not None:
                out['trunk_flex_vel_max'] = max_abs_vel

    # max_cog_velo — trunk COM 3D vector velocity max [KH-20, BR+5]
    if events['fc'] is not None and events['br'] is not None:
        kh_for = events['kh'] if events['kh'] is not None else events['fc']
        lo = max(0, kh_for - 20)
        hi = events['br'] + 5
        ri_lo, ri_hi = td._row_range(lo, hi)
        if ri_lo is not None and all(c in td.cols for c in
                                       ['trunk_center_of_mass_x', 'trunk_center_of_mass_y', 'trunk_center_of_mass_z']):
            sub = td.df.iloc[ri_lo:ri_hi+1]
            cx = sub['trunk_center_of_mass_x'].apply(safe_num).values
            cy = sub['trunk_center_of_mass_y'].apply(safe_num).values
            cz = sub['trunk_center_of_mass_z'].apply(safe_num).values
            ff = sub['frame'].apply(safe_num).values
            dt = 1 / fps
            max_v = None
            for i in range(1, len(cx)):
                if any(pd.isna([cx[i], cy[i], cz[i], cx[i-1], cy[i-1], cz[i-1]])):
                    continue
                df_ = ff[i] - ff[i-1]
                if df_ <= 0:
                    continue
                dx = cx[i] - cx[i-1]
                dy = cy[i] - cy[i-1]
                dz = cz[i] - cz[i-1]
                vel = math.sqrt(dx*dx + dy*dy + dz*dz) / (df_ * dt)
                if max_v is None or vel > max_v:
                    max_v = vel
            if max_v is not None:
                out['max_cog_velo'] = max_v

    # hip_ir_vel_max_drive
    if events['kh'] is not None and events['fc'] is not None:
        col = f'{drive_side}_hip_internal_rotation_velocity_with_respect_to_pelvis'
        v = td.col_max_between(col, events['kh'], events['fc'])
        if v is not None:
            out['hip_ir_vel_max_drive'] = v

    # elbow_ext_vel_max
    if events['fc'] is not None and events['br'] is not None:
        col = f'{arm_side}_elbow_flexion_velocity'
        out['elbow_ext_vel_max'] = td.col_max_abs_between(col, events['fc'], events['br'] + 5)

    # shoulder_ir_vel_max — [v33.10] raw abs max → 95-percentile robust 산출
    #   Theia 비교 결과: raw abs max는 noise spike 취약 (38719°/s 같은 outlier). 95%ile로 안정화.
    if events['mer'] is not None and events['br'] is not None:
        col = f'{arm_side}_shoulder_external_rotation_velocity'
        if col in td.cols:
            ri_lo, ri_hi = td._row_range(events['mer'] - 30, events['br'] + 30)
            if ri_lo is not None:
                s = td.df.iloc[ri_lo:ri_hi+1][col].apply(safe_num).dropna().abs()
                if len(s):
                    sorted_vals = sorted(s.values)
                    idx_95 = min(len(sorted_vals)-1, int(len(sorted_vals) * 0.95))
                    out['shoulder_ir_vel_max'] = float(sorted_vals[idx_95])

    if out.get('elbow_ext_vel_max') and out.get('shoulder_ir_vel_max') and out['shoulder_ir_vel_max'] > 0:
        out['arm_to_forearm_speedup'] = out['elbow_ext_vel_max'] / out['shoulder_ir_vel_max']

    # peak_torso_counter_rot
    if events['kh'] is not None and events['fc'] is not None:
        mn = td.col_min_between('trunk_global_rotation', max(0, events['kh'] - 50), events['fc'])
        mx = td.col_max_between('trunk_global_rotation', max(0, events['kh'] - 50), events['fc'])
        if mn is not None and mx is not None:
            out['peak_torso_counter_rot'] = abs(mx - mn)

    # torso_side_bend_at_mer / torso_rotation_at_br
    if events['mer'] is not None:
        v = td.val_at(events['mer'], 'trunk_lateral_flexion_right')
        if v is not None:
            out['torso_side_bend_at_mer'] = abs(v)
    if events['br'] is not None:
        v = td.val_at(events['br'], 'trunk_global_rotation')
        if v is not None:
            out['torso_rotation_at_br'] = abs(v)

    # max_shoulder_ER — Uplift MER + 윈도우 max
    er_col = f'{arm_side}_shoulder_external_rotation'
    er_cands = []
    if events['mer'] is not None:
        v = td.val_at(events['mer'], er_col)
        if v is not None:
            er_cands.append(v)
    win_f = (events['kh'] - 10) if events['kh'] is not None else (events['fc'] - 100 if events['fc'] is not None else None)
    win_t = (events['br'] + 30) if events['br'] is not None else None
    if win_f is not None and win_t is not None:
        v = td.col_max_between(er_col, win_f, win_t)
        if v is not None:
            er_cands.append(v)
    if er_cands:
        out['max_shoulder_ER'] = max(er_cands)

    # arm_slot_angle, release_height, stride_length (P 변수)
    if events['br'] is not None:
        sP, wP = f'{arm_side}_shoulder_jc_3d', f'{arm_side}_wrist_jc_3d'
        sx = td.val_at(events['br'], f'{sP}_x'); sy = td.val_at(events['br'], f'{sP}_y'); sz = td.val_at(events['br'], f'{sP}_z')
        wx = td.val_at(events['br'], f'{wP}_x'); wy = td.val_at(events['br'], f'{wP}_y'); wz = td.val_at(events['br'], f'{wP}_z')
        if all(v is not None for v in (sx, sy, sz, wx, wy, wz)):
            v_diff = wy - sy
            h_diff = math.sqrt((wx-sx)**2 + (wz-sz)**2)
            out['arm_slot_angle_trial'] = math.atan2(v_diff, h_diff) * 180 / math.pi

    if events['br'] is not None and events['fc'] is not None:
        wP = f'{arm_side}_wrist_jc_3d'
        wy = td.val_at(events['br'], f'{wP}_y')
        lay = td.val_at(events['fc'], 'left_ankle_jc_3d_y')
        ray = td.val_at(events['fc'], 'right_ankle_jc_3d_y')
        if wy is not None and lay is not None and ray is not None:
            out['release_height_trial'] = wy - (lay + ray) / 2
        elif wy is not None and (lay is not None or ray is not None):
            out['release_height_trial'] = wy - (lay if lay is not None else ray)

    if events['kh'] is not None and events['fc'] is not None:
        fP = f'{front_side}_ankle_jc_3d'
        fxKH = td.val_at(events['kh'], f'{fP}_x'); fyKH = td.val_at(events['kh'], f'{fP}_y'); fzKH = td.val_at(events['kh'], f'{fP}_z')
        fxFC = td.val_at(events['fc'], f'{fP}_x'); fyFC = td.val_at(events['fc'], f'{fP}_y'); fzFC = td.val_at(events['fc'], f'{fP}_z')
        if all(v is not None for v in (fxKH, fyKH, fzKH, fxFC, fyFC, fzFC)):
            out['stride_length_trial'] = math.sqrt((fxFC-fxKH)**2 + (fyFC-fyKH)**2 + (fzFC-fzKH)**2)

    if events['mer'] is not None and events['br'] is not None:
        out['mer_to_br_time_trial'] = (events['br'] - events['mer']) / fps * 1000

    if events['br'] is not None:
        out['trunk_tilt_at_br_trial'] = td.val_at(events['br'], 'trunk_lateral_flexion_right')

    # ════════════════════════════════════════════════════════════
    # Phase 3 (v33.6) — Output / Transfer / Injury 7변수
    # ════════════════════════════════════════════════════════════
    throwing_arm = throwing_arm_detected

    def _3d_speed_at_br(jc_prefix):
        if events['br'] is None:
            return None
        cx, cy, cz = f'{jc_prefix}_x', f'{jc_prefix}_y', f'{jc_prefix}_z'
        if not all(c in td.cols for c in (cx, cy, cz)):
            return None
        speeds = []
        dt = 1 / fps
        for offset in [-2, -1, 0, 1, 2]:
            f1 = events['br'] + offset - 1
            f2 = events['br'] + offset + 1
            x1 = td.val_at(f1, cx); y1 = td.val_at(f1, cy); z1 = td.val_at(f1, cz)
            x2 = td.val_at(f2, cx); y2 = td.val_at(f2, cy); z2 = td.val_at(f2, cz)
            if any(v is None for v in (x1, y1, z1, x2, y2, z2)):
                continue
            speeds.append(math.sqrt((x2-x1)**2 + (y2-y1)**2 + (z2-z1)**2) / (2*dt))
        if not speeds:
            return None
        speeds.sort()
        return speeds[len(speeds)//2]

    forearm_length = None
    if events['br'] is not None:
        ePre = f'{throwing_arm}_elbow_jc_3d'
        wPre = f'{throwing_arm}_wrist_jc_3d'
        ex = td.val_at(events['br'], f'{ePre}_x'); ey = td.val_at(events['br'], f'{ePre}_y'); ez = td.val_at(events['br'], f'{ePre}_z')
        wx = td.val_at(events['br'], f'{wPre}_x'); wy = td.val_at(events['br'], f'{wPre}_y'); wz = td.val_at(events['br'], f'{wPre}_z')
        if all(v is not None for v in (ex, ey, ez, wx, wy, wz)):
            forearm_length = math.sqrt((wx-ex)**2 + (wy-ey)**2 + (wz-ez)**2)
            out['forearm_length_m'] = forearm_length

    # 1) wrist_release_speed
    wrist_speed = _3d_speed_at_br(f'{throwing_arm}_wrist_jc_3d')
    if wrist_speed is not None:
        out['wrist_release_speed'] = wrist_speed

    # 2) elbow_to_wrist_speedup
    if out.get('wrist_release_speed') is not None:
        elbow_speed = _3d_speed_at_br(f'{throwing_arm}_elbow_jc_3d')
        if elbow_speed is not None and elbow_speed > 0.1:
            out['elbow_to_wrist_speedup'] = out['wrist_release_speed'] / elbow_speed

    # 3) angular_chain_amplification
    if out.get('peak_arm_av') and out.get('peak_pelvis_av') and out['peak_pelvis_av'] > 0:
        out['angular_chain_amplification'] = out['peak_arm_av'] / out['peak_pelvis_av']

    # 4) elbow_valgus_torque_proxy
    if out.get('shoulder_ir_vel_max') and forearm_length and forearm_length > 0:
        omega_rad = out['shoulder_ir_vel_max'] * math.pi / 180.0
        m_forearm = 1.6
        out['elbow_valgus_torque_proxy'] = 0.5 * m_forearm * forearm_length**2 * omega_rad**2

    # 5) stride_to_pelvis_lag_ms
    if events['fc'] is not None and events['peakPelvis'] is not None:
        out['stride_to_pelvis_lag_ms'] = (events['peakPelvis'] - events['fc']) / fps * 1000

    # 6) x_factor_to_peak_pelvis_lag_ms
    if events['kh'] is not None and events['fc'] is not None and events['peakPelvis'] is not None:
        col_a = 'trunk_global_rotation' if arm_side == 'left' else 'pelvis_global_rotation'
        col_b = 'pelvis_global_rotation' if arm_side == 'left' else 'trunk_global_rotation'
        if col_a in td.cols and col_b in td.cols:
            best_xf = None
            best_frame = None
            for f in range(int(events['kh']), int(events['fc']) + 6):
                a = td.val_at(f, col_a)
                b = td.val_at(f, col_b)
                if a is None or b is None:
                    continue
                xf = a - b
                if best_xf is None or xf > best_xf:
                    best_xf = xf
                    best_frame = f
            if best_frame is not None:
                out['x_factor_to_peak_pelvis_lag_ms'] = (events['peakPelvis'] - best_frame) / fps * 1000

    # 7) knee_varus_max_drive
    if events['kh'] is not None and events['fc'] is not None:
        v = td.col_max_abs_between(f'{drive_side}_knee_varus', events['kh'], events['fc'])
        if v is not None:
            out['knee_varus_max_drive'] = v

    # ball_speed (Uplift 컬럼이 있으면 사용)
    if 'pitch_speed_mph' in td.cols:
        v = safe_num(r0.get('pitch_speed_mph'))
        if v is not None:
            out['ball_speed_kmh'] = v * 1.609344
    elif 'ball_speed_kmh' in td.cols:
        v = safe_num(r0.get('ball_speed_kmh'))
        if v is not None:
            out['ball_speed_kmh'] = v

    return out


if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1:
        result = extract_scalars(sys.argv[1])
        for k, v in result.items():
            if k in ('events', '_csv_path'):
                continue
            print(f"{k:<35} {v}")
