from PIL import Image
import glob
import os

def process_image(filepath):
    img = Image.open(filepath).convert("RGBA")
    datas = img.getdata()
    newData = []
    
    # We define a threshold for "white"
    threshold = 240
    
    for item in datas:
        # if the pixel is near white, make it transparent
        if item[0] >= threshold and item[1] >= threshold and item[2] >= threshold:
            newData.append((255, 255, 255, 0))
        else:
            newData.append(item)
            
    img.putdata(newData)
    img.save(filepath, "PNG")
    print(f"Processed {filepath}")

files = glob.glob("public/diamonds/*.png") + glob.glob("public/settings/*.png")
for f in files:
    process_image(f)
