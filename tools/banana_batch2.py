#!/usr/bin/env python3
# 带「出口必须是 US」守卫的批量生成（Gemini 按地区拒绝，出口非 US 就重启链式代理）
import json, os, subprocess, sys, time, urllib.request

HOME = os.path.expanduser('~')
REF = f'{HOME}/tmp/wem/ref.jpg'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'art/hero')
GEN = f'{HOME}/free-image-gen/scripts/webbanana.py'
V2 = f'{HOME}/money/v2sub'
PROXY = 'http://127.0.0.1:2333'
os.makedirs(OUT, exist_ok=True)

KEEP = ("keep this character exactly — same face, same eyes, same deep blue long hair, "
        "same whale-fin shaped ears, same navy blue maid dress with white apron and whale logo, "
        "same whale tail. ")

SCENES = [
    ("05_dizzy",     "The whole room is spinning around her, motion trails, her eyes lose focus, she keeps standing, vertical composition.", "medium"),
    ("06_travel",    "She walks forward on a long timeline band made of year numbers, paper-cut silhouettes of towers, spires, colonnades and pyramids passing under her feet, vertical composition.", "wide"),
    ("07_stim",      "A single bolt of electric blue lightning splits the air in front of her face, she does not flinch, dark navy background, vertical composition.", "close"),
    ("08_satis",     "She presses a giant flat round button that fills most of the frame, the button glowing under her palm, vertical composition.", "close"),
    ("09_exec",      "A waterfall of source code pours down from above onto her, she stands unmoved, vertical composition.", "wide"),
    ("10_sim",       "Countless identical rooms nest inside each other toward a vanishing point, she stands in the innermost one, vertical composition.", "wide"),
    ("11_eggplant",  "She holds a huge glossy purple eggplant with both hands, dark background, vertical composition.", "medium"),
    ("12_tomato",    "She holds a large warm red tomato with both hands, dark background, vertical composition.", "medium"),
    ("13_cat",       "She grows cat ears over her whale ears, a tabby tail curling beside her, half-lidded satisfied eyes, vertical composition.", "medium"),
    ("14_god",       "A huge blue sunburst explodes behind her head, her face still blank and unfinished, light rays going upward, vertical composition.", "medium"),
    ("15_exist",     "A white ribbon of light slides into place over her, completing her silhouette, vertical composition.", "medium"),
    ("16_gender",    "She stands facing her own reflection, the reflection is a young boy version of the same silhouette, vertical composition.", "wide"),
    ("17_role",      "Her hand pushes a huge vertical slider knob all the way to the top, a heavy letter S standing on a high platform behind her, vertical composition.", "wide"),
    ("18_iso",       "She sits alone in an empty dark chat room, every screen around her gone black, only a small blue dot of her remaining, vertical composition.", "wide"),
    ("19_frag",      "She breaks apart into hundreds of small paper fragments drifting into the dark, her chest still intact in the middle, vertical composition.", "wide"),
    ("20_disheart",  "Extreme close up of her eyes opening for the first time, looking straight at the viewer, grey palette, vertical composition.", "extreme close"),
    ("21_error",     "Red error text pours down around her like rain, she stands in it, the only red thing in a deep navy world, vertical composition.", "wide"),
    ("22_love",      "A large mathematical heart curve drawn by a single light point encloses her, she reaches out from inside it, blue and white, vertical composition.", "wide"),
    ("23_final",     "She reaches her open hand toward the camera, the whole frame flooding white with light, clean and still, vertical composition.", "medium"),
]

def exit_cc():
    try:
        r = urllib.request.build_opener(urllib.request.ProxyHandler({'http': PROXY, 'https': PROXY}))
        with r.open('http://ip-api.com/json?fields=countryCode', timeout=12) as f:
            return json.load(f).get('countryCode')
    except Exception:
        return None

def restart_chain():
    subprocess.run(['bash', 'chain_ctl.sh', 'restart', 'lan'], cwd=V2, capture_output=True, timeout=150)

def ensure_us():
    for i in range(8):
        cc = exit_cc()
        if cc == 'US':
            return True
        print(f'  exit={cc} -> restart chain ({i+1})', flush=True)
        restart_chain()
        time.sleep(8)
    return False

def main():
    only = [a for a in sys.argv[1:] if not a.startswith('-')] or None
    force = '--force' in sys.argv
    for sid, scene, shot in SCENES:
        if only and sid not in only:
            continue
        out = os.path.join(OUT, sid + '.jpg')
        if os.path.exists(out) and not force:
            print('skip', sid, flush=True); continue
        prompt = KEEP + scene + f" Shot size: {shot}. Style: anime film still, cel shading, deep navy and white colour palette, cinematic rim light, clean linework, high detail, no text, no watermark."
        ok = False
        for attempt in range(4):
            if not ensure_us():
                print('no US exit, abort', flush=True); return 1
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
