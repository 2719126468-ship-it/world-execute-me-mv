#!/usr/bin/env python3
# 重画被视觉评审判废/勉强的图：加强硬约束，避免文字残留、白底、双人、手画错
import json, os, subprocess, sys, time, urllib.request

HOME = os.path.expanduser('~')
REF = f'{HOME}/tmp/wem/ref.jpg'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'art/hero')
GEN = f'{HOME}/free-image-gen/scripts/webbanana.py'
V2 = f'{HOME}/money/v2sub'
PROXY = 'http://127.0.0.1:2347'  # 钉死 Datacamp-NYC 出口

KEEP = ("keep this character exactly — same face, same eyes, same deep blue long hair, "
        "same whale-fin shaped ears, same navy blue maid dress with white apron and whale logo, "
        "same whale tail. ")
HARD = (" Hard rules: exactly one character in frame, no mirror and no reflection and no second person. "
        "Solid dark navy background, absolutely no white or bright background. "
        "No text, no letters, no numbers, no symbols, no captions, no watermark, no signature, no interface. "
        "Both hands relaxed and simple, or hidden behind her back — no complicated hand poses, no extra fingers. "
        "Medium shot, the character fills about 80% of the frame height, centred. ")

SCENES = [
    ("01_boot",     "She stands quietly in a dark empty room, a few thin blue light lines floating near her, eyes closed."),
    ("03_geometry", "Flat paper shapes of a point, a circle and a sine wave float around her at chest height."),
    ("05_dizzy",    "Her body stays still while the dark room tilts around her, faint motion smear, eyes unfocused."),
    ("06_travel",   "She walks forward through dark space; behind her, large flat silhouettes of historic buildings recede into fog."),
    ("07_stim",     "A thin bolt of electric blue light passes well in front of her chest, her face fully visible and lit."),
    ("09_exec",     "Thin blue lines of falling light stream down behind her, like rain made of light, no glyph shapes."),
    ("10_sim",      "She stands alone in a dark room whose walls recede into several nested rectangles behind her."),
    ("12_tomato",   "She holds one large deep red tomato at her waist with both hands, the tomato is small relative to her body."),
    ("14_god",      "A huge dark blue sunburst halo opens behind her head, her face slightly lit from the front."),
    ("16_gender",   "She stands alone facing the camera, one thin flat vertical light panel beside her, no mirror, no reflection."),
    ("17_role",     "She stands beside a tall dark vertical slider rail, her hand resting on the rail handle, simple hands."),
    ("20_disheart", "Close medium shot of her face and shoulders in a dark room, eyes open looking at the camera, calm."),
    ("21_error",    "She stands alone in a dark room with a single thin red light line crossing the far wall."),
    ("23_final",    "She stands in a dark room lit from above by one soft white light, both arms relaxed at her sides."),
]

def exit_cc():
    try:
        r = urllib.request.build_opener(urllib.request.ProxyHandler({'http': PROXY, 'https': PROXY}))
        with r.open('http://ip-api.com/json?fields=countryCode', timeout=12) as f:
            return json.load(f).get('countryCode')
    except Exception:
        return None

def restart_chain():
    # 重启 :2347（datacamp_egress.json = 米兰中转 -> Datacamp-NYC）
    subprocess.Popen(['pkill', '-f', 'datacamp_egress.json'], capture_output=True)
    time.sleep(2)
    subprocess.Popen(['sing-box', 'run', '-c', 'datacamp_egress.json'], cwd=V2,
                     stdout=open(os.path.join(V2, 'datacamp.log'), 'a'),
                     stderr=subprocess.STDOUT, start_new_session=True)
    time.sleep(7)

def ensure_us():
    for i in range(8):
        if exit_cc() in ('US', 'CA'):
            return True
        print('  restart chain', i + 1, flush=True)
        restart_chain(); time.sleep(8)
    return False

def main():
    for sid, scene in SCENES:
        out = os.path.join(OUT, sid + '.jpg')
        old_dir = os.path.join(ROOT, 'art/hero_old')
        os.makedirs(old_dir, exist_ok=True)
        if os.path.exists(out):
            os.replace(out, os.path.join(old_dir, sid + '.jpg'))  # 先移走旧图，避免误判
        prompt = KEEP + scene + " Style: anime film still, cel shading, deep navy and white colour palette, cinematic rim light, clean linework, high detail." + HARD
        ok = False
        for attempt in range(4):
            # 出口已钉死在 :2347（Datacamp-NYC），这里只做一次轻探测，不再来回重启代理
            if attempt == 0:
                cc = exit_cc()
                print('  exit:', cc, flush=True)
                if cc not in ('US', 'CA') and not ensure_us():
                    print('no US exit, continue anyway', flush=True)
            r = subprocess.run(['python3', GEN, out, prompt, 'pro', '--ref', REF, '--camo', 'none'],
                               env={**os.environ, 'GEMINI_PROXY': PROXY},
                               capture_output=True, text=True, timeout=420)
            if os.path.exists(out) and os.path.getsize(out) > 20000:
                print('ok', sid, os.path.getsize(out), flush=True); ok = True; break
            tail = (r.stdout + r.stderr).strip().split('\n')[-1][:140]
            print('retry', sid, attempt, tail, flush=True)
            if 'LOCATION_REJECTED' in (r.stdout + r.stderr):
                restart_chain(); time.sleep(10)
            else:
                time.sleep(5)
        if not ok:
            print('FAIL', sid, flush=True)
        time.sleep(1)
    return 0

if __name__ == '__main__':
    sys.exit(main())
