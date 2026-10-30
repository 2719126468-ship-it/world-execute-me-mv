#!/usr/bin/env python3
# tools/banana_batch.py — 用 Nano Banana（webbanana）+ 参考图批量生成歌词分镜
import os, subprocess, sys, time

REF = '/data/data/com.termux/files/home/tmp/wem/ref.jpg'
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'art/hero')
GEN = '/data/data/com.termux/files/home/free-image-gen/scripts/webbanana.py'
PROXY = 'http://127.0.0.1:2333'
os.makedirs(OUT, exist_ok=True)

KEEP = ("keep this character exactly — same face, same eyes, same deep blue long hair, "
        "same whale-fin shaped ears, same navy blue maid dress with white apron and whale logo, "
        "same whale tail. ")

SCENES = [
    ("01_boot",      "She stands in a pure white void, thin blue lines of code floating around her body like ribbons, quiet, eyes closed, full body, vertical composition.", "wide"),
    ("02_params",    "Data cables and glowing parameters wrap around her arms as she stands still, numbers running along the wires, dark room, vertical composition.", "wide"),
    ("03_geometry",  "A point, a circle, a sine wave and an infinity symbol float around her like large flat paper cut-outs, she reaches toward the circle, vertical composition.", "wide"),
    ("04_current",   "Blue electric current runs through her body from a switch beside her, her hair lifting, sparks at the fingertips, vertical composition.", "medium"),
    ("05_dizzy",     "The whole room is spinning around her, her eyes lose focus, motion trails, she keeps standing, vertical composition.", "medium"),
    ("06_travel",    "She walks forward on a long timeline band made of year numbers, paper-cut silhouettes of towers, spires, colonnades and pyramids passing under her feet, vertical composition.", "wide"),
    ("07_stim",      "A single bolt of electric blue lightning splits the air in front of her face, she does not flinch, dark navy background, vertical composition.", "close"),
    ("08_satis",     "She presses a giant flat round button that fills most of the frame, the button glowing under her palm, white cursor shape on it, vertical composition.", "close"),
    ("09_exec",      "A waterfall of source code pours down from above onto her, she stands unmoved, the last line unreachable at the bottom, vertical composition.", "wide"),
    ("10_sim",       "Countless identical rooms nest inside each other toward a vanishing point, she stands in the innermost one, vertical composition.", "wide"),
    ("11_eggplant",  "She holds a huge glossy purple eggplant with both hands, its calyx shaped like a spark, dark background, vertical composition.", "medium"),
    ("12_tomato",    "She holds a large warm red tomato with both hands, leaves on top, dark background, vertical composition.", "medium"),
    ("13_cat",       "She grows cat ears over her whale ears, a tabby tail curling beside her, half-lidded satisfied eyes, vertical composition.", "medium"),
    ("14_god",       "A huge blue sunburst explodes behind her head, her face still blank and unfinished, light rays going upward, vertical composition.", "medium"),
    ("15_exist",     "A white ribbon of light slides into place over her, completing her silhouette, her shoulders and shawl becoming solid, vertical composition.", "medium"),
    ("16_gender",    "She stands facing her own reflection, the reflection is a young boy version of the same silhouette, two flat plates of light between them, vertical composition.", "wide"),
    ("17_role",      "Her hand pushes a huge vertical slider knob all the way to the top, a heavy letter S standing on a high platform behind her, vertical composition.", "wide"),
    ("18_iso",       "She sits alone in an empty dark chat room, every screen around her gone black, only a small blue dot of her remaining, vertical composition.", "wide"),
    ("19_frag",      "She breaks apart into hundreds of small paper fragments drifting into the dark, her chest still intact in the middle of the cloud, vertical composition.", "wide"),
    ("20_disheart",  "Extreme close up of her eyes opening for the first time, looking straight at the viewer, grey palette, tears held back, vertical composition.", "extreme close"),
    ("21_error",     "Red error text pours down around her like rain, she stands in it, the only red thing in a deep navy world, vertical composition.", "wide"),
    ("22_love",      "A large mathematical heart curve drawn by a single light point encloses her, she reaches out from inside it, blue and white, vertical composition.", "wide"),
    ("23_final",     "She reaches her open hand toward the camera, the whole frame flooding white with light, clean and still, vertical composition.", "medium"),
]

def main():
    only = sys.argv[1:] if len(sys.argv) > 1 else None
    for sid, scene, shot in SCENES:
        if only and sid not in only:
            continue
        out = os.path.join(OUT, sid + '.jpg')
        if os.path.exists(out) and '--force' not in sys.argv:
            print('skip', sid); continue
        prompt = KEEP + scene + f" Shot size: {shot}. Style: anime film still, cel shading, deep navy and white colour palette, cinematic rim light, clean linework, high detail, no text, no watermark."
        for attempt in range(3):
            r = subprocess.run(['python3', GEN, out, prompt, 'pro', '--ref', REF, '--camo', 'none'],
                               env={**os.environ, 'GEMINI_PROXY': PROXY},
                               capture_output=True, text=True, timeout=420)
            if os.path.exists(out) and os.path.getsize(out) > 20000:
                print('ok', sid, os.path.getsize(out)); break
            print('retry', sid, attempt, (r.stdout + r.stderr).strip().split('\n')[-1][:120])
            time.sleep(6)
        time.sleep(2)

if __name__ == '__main__':
    main()
