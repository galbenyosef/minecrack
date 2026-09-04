"""Rebuild Minecrack's original 512 px item textures and transparent inventory art.

Only stdlib + Pillow needed. Internet references are documented in ASSET-SOURCES.md.
Downloaded marks/covers stay separate and are placed on the corresponding 3D mesh.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math, random

OUT = Path(__file__).resolve().parents[1] / 'public/assets/items'
OUT.mkdir(parents=True, exist_ok=True)
S = 512
FONT = Path('C:/Windows/Fonts/arialbd.ttf')
REG = Path('C:/Windows/Fonts/arial.ttf')
def font(size, bold=True):
    return ImageFont.truetype(str(FONT if bold else REG), size)
def text(d, xy, value, size, fill='#ffffff', anchor='mm', bold=True):
    d.text(xy, value, font=font(size,bold), fill=fill, anchor=anchor)
def line(d, points, fill, width=5):
    d.line(points, fill=fill, width=width, joint='curve')
def rounded(d, xy, radius, fill, outline=None, width=1):
    d.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)
def ell(d, xy, fill, outline=None, width=1):
    d.ellipse(xy, fill=fill, outline=outline, width=width)
def poly(d, points, fill, outline=None, width=1):
    d.polygon(points, fill=fill, outline=outline, width=width)
def icon():
    im=Image.new('RGBA',(S,S)); return im,ImageDraw.Draw(im)
def save(im,id):
    # Generated inventory illustration; retain transparency around silhouette.
    im.save(OUT/f'{id}.png',optimize=True)
def shadow(d): ell(d,(74,414,438,466),(0,0,0,42))

colors={'chocolatine':(195,119,46),'cuir':(117,63,38),'poche':(230,185,202),
        'impots':(219,242,218),'journal':(255,244,215),'urssaf':(34,56,83),
        'nucleaire':(168,180,185),'b2':(45,57,69),'socialiste':(233,69,96),
        'cb12':(244,239,219),'zerator':(73,177,79),'gnome':(207,50,44),
        'megaphone':(74,164,67),'tgv':(47,57,67),'furry':(219,128,41),
        'radio':(195,199,167)}
for id,c in colors.items():
    rng=random.Random('minecrack:'+id)
    im=Image.new('RGB',(S,S));pix=im.load()
    for y in range(S):
        for x in range(S):
            n=rng.gauss(0,4.8)
            # Fine grain and an unobtrusive panel gradient, generated at native resolution.
            v=math.sin(x*.024)*2+math.cos(y*.039)*2+n
            pix[x,y]=tuple(max(0,min(255,int(k+v))) for k in c)
    d=ImageDraw.Draw(im)
    if id=='chocolatine':
        for y in range(0,512,19):
            line(d,[(0,y),(120,y+9),(270,y-7),(400,y+8),(512,y)],'#c68d4c',3)
            line(d,[(0,y+4),(130,y+13),(290,y-3),(512,y+4)],'#dfab60',2)
    elif id=='cuir':
        for _ in range(1800):
            x,y=rng.randrange(512),rng.randrange(512)
            line(d,[(x,y),(x+3,y+2),(x+2,y+5)],'#854a2f',1)
        for p in range(16,500,18):
            line(d,[(p,15),(p+7,19)],'#d5a577',2);line(d,[(p,493),(p+7,489)],'#d5a577',2)
    elif id in ['b2','tgv','radio','nucleaire']:
        for y in range(16,512,64):
            line(d,[(0,y),(512,y)],tuple(max(0,k-15) for k in c),2)
        for x in range(24,512,64):
            for y in range(24,512,64): ell(d,(x-2,y-2,x+2,y+2),tuple(max(0,k-25) for k in c))
    elif id=='furry':
        for _ in range(9500):
            x,y=rng.randrange(512),rng.randrange(512)
            shade=rng.choice(['#e7a35c','#cb762a','#f1b872'])
            line(d,[(x,y),(x+1,y+5)],shade,1)
    elif id=='urssaf':
        for x in range(0,512,12): line(d,[(x,0),(x,512)],'#293f5b',1)
    else:
        for _ in range(1000):
            x,y=rng.randrange(512),rng.randrange(512)
            line(d,[(x,y),(x+2,y)],tuple(max(0,k-5) for k in c),1)
    im.save(OUT/f'{id}-texture.png',optimize=True)

# Chocolatine: flaky rolled pastry with two chocolate bars.
im,d=icon();shadow(d)
poly(d,[(76,244),(131,132),(389,140),(444,260),(408,394),(109,397)],'#8c4a22')
rounded(d,(74,148,440,369),64,'#bd702b','#713a22',7)
rounded(d,(91,146,427,331),60,'#ecb45b','#ad6529',5)
for i in range(10):
    y=171+i*15
    d.arc((81,y-34,431,y+102),190,345,fill=('#ffcf75' if i%2 else '#b76a29'),width=5)
for x in [139,323]:
    rounded(d,(x,282,x+56,345),12,'#43251c');line(d,[(x+7,291),(x+42,291)],'#784330',5)
for x,y in [(120,203),(214,169),(354,201),(201,284),(378,266)]: line(d,[(x,y),(x+21,y+3)],'#ffe09a',3)
save(im,'chocolatine')

im,d=icon();shadow(d)
points=[(177,94),(227,121),(291,116),(347,91),(379,171),(415,215),(390,287),(427,367),(339,396),(290,439),(231,411),(142,430),(111,363),(80,310),(114,250),(86,181),(155,157)]
poly(d,[(x+8,y+9) for x,y in points],'#56331f');poly(d,points,'#a5683c','#613a23',6)
for i in range(len(points)):
    a,b=points[i],points[(i+1)%len(points)]
    for t in [.18,.42,.66,.86]:
        x=a[0]*(1-t)+b[0]*t;y=a[1]*(1-t)+b[1]*t
        line(d,[(x*.91+23,y*.91+23),(x*.91+30,y*.91+27)],'#e7bb7b',3)
line(d,[(158,223),(215,204),(298,231),(354,202)],'#965a34',4)
line(d,[(155,316),(251,351),(353,307)],'#ba7c47',5);save(im,'cuir')

im,d=icon();shadow(d)
rounded(d,(146,67,366,384),100,'#efc5d0','#ac667a',6)
rounded(d,(229,31,283,109),24,'#f4d7de','#ac667a',5)
rounded(d,(170,101,193,340),10,'#ffe9ed')
ell(d,(120,337,392,436),'#d397ac','#97566c',7)
ell(d,(142,349,369,416),'#f6ccd9','#b6768e',6)
ell(d,(163,362,349,400),'#b5798e');save(im,'poche')

im,d=icon();shadow(d)
poly(d,[(114,73),(346,53),(407,133),(407,430),(114,453)],'#83b899','#245848',6)
poly(d,[(101,60),(336,60),(395,122),(395,425),(101,425)],'#ecf8e8','#477b67',5)
poly(d,[(336,60),(336,122),(395,122)],'#bddfc3')
rounded(d,(127,97,179,130),6,'#396fb0');rounded(d,(179,97,225,130),6,'#ffffff');rounded(d,(225,97,276,130),6,'#dc5953')
text(d,(250,179),'RÉDUCTION',31,'#244a3c');text(d,(250,219),"D’IMPÔTS",34,'#244a3c')
for y,w in [(267,208),(286,173),(305,191)]:line(d,[(145,y),(145+w,y)],'#9bb7a3',5)
ell(d,(224,323,345,399),'#5fab65');text(d,(285,362),'−100%',28,'#ffffff');save(im,'impots')

# Book front uses the actual publisher cover, stored verbatim in references/.
im,d=icon();shadow(d)
poly(d,[(92,87),(131,56),(415,64),(415,419),(377,451),(92,446)],'#68593f')
poly(d,[(100,96),(134,73),(396,78),(396,408),(370,432),(100,426)],'#faf1d8')
for y in range(115,420,9):line(d,[(104,y),(132,y-14)],'#b7ae97',2)
cover=Image.open(OUT/'references/journal-cover.jpeg').convert('RGBA').resize((259,362),Image.Resampling.LANCZOS)
im.alpha_composite(cover,(132,61));d=ImageDraw.Draw(im)
line(d,[(132,62),(132,422)],'#af9f7b',5);save(im,'journal')

im,d=icon();shadow(d)
rounded(d,(123,196,393,423),38,'#20384e','#142936',6)
poly(d,[(205,197),(262,319),(316,199)],'#eef2df')
poly(d,[(258,232),(244,271),(264,348),(283,269),(271,232)],'#d34740')
ell(d,(182,67,334,226),'#edbd90','#ae7c59',5)
rounded(d,(178,64,338,122),22,'#53402c');line(d,[(195,151),(247,151)],'#283744',13);line(d,[(270,151),(321,151)],'#283744',13);line(d,[(244,151),(273,151)],'#283744',5)
line(d,[(235,190),(278,190)],'#985b42',4)
rounded(d,(79,276,222,409),12,'#40596c','#172c3b',5);rounded(d,(119,257,179,283),7,None,'#293e4c',8)
rounded(d,(284,289,376,340),7,'#ebeee1');text(d,(329,315),'URSSAF',17,'#23384c');save(im,'urssaf')

im,d=icon();shadow(d)
poly(d,[(70,387),(311,344),(446,397),(216,452)],'#617174','#334247',5)
poly(d,[(70,387),(216,431),(216,456),(70,411)],'#879292');poly(d,[(216,431),(446,381),(446,406),(216,456)],'#425858')
for x,y,w,h in [(104,98,135,303),(276,158,112,227)]:
    poly(d,[(x,y+h),(x+19,y+h*.64),(x+27,y+h*.26),(x+10,y),(x+w-10,y),(x+w-27,y+h*.26),(x+w-19,y+h*.64),(x+w,y+h)],'#b7c3bd','#647775',5)
    ell(d,(x+9,y-16,x+w-9,y+24),'#d4ded4','#738782',5)
    ell(d,(x+24,y-6,x+w-24,y+13),'#4c5f60')
    for o in range(25,w-10,20):line(d,[(x+o,y+32),(x+o-10,y+h-9)],'#9eafaa',2)
ell(d,(148,286,210,346),'#e6ca58')
for start in [30,150,270]:d.pieslice((155,293,203,341),start,start+60,fill='#394348')
ell(d,(169,307,189,327),'#e6ca58');ell(d,(175,313,183,321),'#394348');save(im,'nucleaire')

im,d=icon();shadow(d)
points=[(256,100),(455,306),(413,335),(354,317),(317,349),(276,327),(256,351),(234,327),(194,349),(157,317),(99,335),(57,306)]
poly(d,[(x,y+15) for x,y in points],'#121f29');poly(d,points,'#485767','#152634',5)
poly(d,[(256,100),(301,305),(256,328),(211,305)],'#6a7a84');poly(d,[(256,159),(276,224),(237,224)],'#9cbdc4','#233645',4)
for sign in [-1,1]:
    line(d,[(256+sign*33,220),(256+sign*127,297),(256+sign*180,310)],'#87949c',3)
    poly(d,[(256+sign*56,266),(256+sign*77,285),(256+sign*46,286),(256+sign*40,267)],'#172e3c')
text(d,(256,383),'B–2',37,'#f0e6c4');save(im,'b2')

im,d=icon();shadow(d)
rounded(d,(73,125,438,387),28,'#a53554');rounded(d,(59,105,424,368),28,'#f0647f','#a53554',6)
rounded(d,(80,125,403,340),19,'#fff4e9')
logo=Image.open(OUT/'references/socialiste-logo.png').convert('RGBA');logo.thumbnail((250,124),Image.Resampling.LANCZOS);im.alpha_composite(logo,(112,151))
d=ImageDraw.Draw(im);text(d,(241,290),'CARTE DE MEMBRE',22,'#a83f58');line(d,[(106,316),(374,316)],'#e8a0ad',3);save(im,'socialiste')

im,d=icon();shadow(d)
poly(d,[(125,57),(381,57),(381,430),(360,418),(338,436),(316,419),(294,436),(272,419),(250,436),(228,419),(206,436),(184,419),(162,436),(141,420),(125,430)],'#f2ead1','#8d8c75',4)
text(d,(254,103),'M',58,'#e4b421');text(d,(254,151),"McDonald’s",27,'#303932')
line(d,[(155,181),(352,181)],'#969888',2);text(d,(254,235),'CB12',77,'#192d29')
text(d,(254,288),'VOTRE COMMANDE',18,'#3e4f47')
for y,w in [(322,168),(341,131),(360,173)]:line(d,[(166,y),(166+w,y)],'#8b9483',3)
for x in range(170,338,5):line(d,[(x,382),(x,402)],'#243b33',2+(x%3==0));save(im,'cb12')

im,d=icon();shadow(d)
ell(d,(121,95,391,441),'#248b4b','#185536',7);ell(d,(151,58,361,394),'#62ba57')
ell(d,(180,97,231,155),'#b9e98e')
logo=Image.open(OUT/'references/zerator-logo.png').convert('RGBA').resize((145,158),Image.Resampling.LANCZOS)
im.alpha_composite(logo,(184,209));save(im,'zerator')

im,d=icon();shadow(d)
ell(d,(110,393,246,453),'#47372b');ell(d,(263,393,398,453),'#47372b')
rounded(d,(140,246,372,423),43,'#306e91','#204b66',6)
ell(d,(165,153,346,322),'#f0c69b','#a57151',5)
poly(d,[(160,241),(186,341),(246,393),(307,342),(345,241)],'#e8e9de','#a1b1a8',5)
for x in [192,217,245,273,298]:line(d,[(x,274),(245+(x-245)*.3,359)],'#c5cfc6',4)
ell(d,(216,228,280,280),'#edb585');ell(d,(190,217,207,232),'#253940');ell(d,(290,217,307,232),'#253940')
poly(d,[(144,184),(235,23),(259,70),(345,187)],'#d74a3e','#8f312e',6);ell(d,(143,166,348,206),'#ea5944');save(im,'gnome')

im,d=icon();shadow(d)
rounded(d,(265,288,314,432),10,'#345446','#152f29',6)
poly(d,[(185,202),(362,99),(362,361),(185,287)],'#e0e8d5','#344e49',6)
poly(d,[(197,225),(342,145),(342,169),(197,244)],'#ffffff')
ell(d,(309,96,418,363),'#74c34f','#24483d',7);ell(d,(330,124,404,337),'#203d35','#b7e477',6)
rounded(d,(100,208,203,289),14,'#4d8751','#284936',5)
text(d,(258,252),'Z',62,'#4a924b');line(d,[(435,174),(461,151)],'#d6eeab',7);line(d,[(444,224),(476,224)],'#d6eeab',7);line(d,[(435,278),(460,302)],'#d6eeab',7);save(im,'megaphone')

im,d=icon();shadow(d)
rounded(d,(139,341,387,411),12,'#a38139','#62532e',5)
for x,y,w,h in [(154,144,96,222),(284,90,115,278)]:
    poly(d,[(x+32,y+h),(x+29,y+74),(x,y+25),(x+w,y+25),(x+w-29,y+74),(x+w-32,y+h)],'#465a63','#1e3742',5)
    ell(d,(x,y,x+w,y+55),'#6d8286','#213641',6);ell(d,(x+13,y+10,x+w-13,y+43),'#102c38')
    line(d,[(x+39,y+75),(x+39,y+h-12)],'#8aa09b',5)
text(d,(264,442),'TGV',32,'#f8db89');save(im,'tgv')

im,d=icon();shadow(d)
rounded(d,(156,248,362,416),40,'#d88439','#965429',6)
rounded(d,(111,264,167,411),23,'#c97432');rounded(d,(350,264,406,411),23,'#c97432')
ell(d,(177,289,337,419),'#f4dec0');ell(d,(115,385,218,452),'#5a4140');ell(d,(293,385,396,452),'#5a4140')
poly(d,[(155,174),(135,42),(219,110)],'#d58038','#775038',6);poly(d,[(293,111),(379,44),(361,176)],'#d58038','#775038',6)
poly(d,[(152,130),(151,74),(195,117)],'#5c463d');poly(d,[(315,116),(365,77),(351,136)],'#5c463d')
rounded(d,(151,103,365,299),70,'#e39646','#8e562f',6)
poly(d,[(169,206),(227,246),(288,245),(347,203),(319,286),(202,286)],'#f3dfbc')
ell(d,(188,175,222,218),'#344042');ell(d,(292,175,326,218),'#344042');ell(d,(196,181,205,190),'#cde8b5');ell(d,(300,181,309,190),'#cde8b5')
poly(d,[(228,244),(284,244),(256,269)],'#313639');save(im,'furry')

im,d=icon();shadow(d)
line(d,[(348,180),(384,47)],'#a3b6a7',10);ell(d,(376,37,390,51),'#d4e0c9')
rounded(d,(159,133,354,216),27,None,'#3e554a',16)
rounded(d,(74,190,433,404),48,'#81917d','#354e43',8)
rounded(d,(86,187,421,382),43,'#dfe3ba','#829278',5)
rounded(d,(116,242,282,345),22,'#465f51','#a8b29a',5)
for y in range(253,339,12):line(d,[(127,y),(270,y)],'#96a588',3)
rounded(d,(294,239,393,276),8,'#365950');text(d,(344,258),'85.2',24,'#d7f2bb')
ell(d,(312,289,377,354),'#687f69','#3b5547',5);line(d,[(344,297),(344,315)],'#edf0c2',4)
ell(d,(99,208,116,225),'#7aca61');text(d,(250,215),'APERTURE',13,'#697c66');save(im,'radio')

# Small printed surfaces have their own crisp 512 px decal maps.
# Wide labels are prewarped to a square; the plane aspect restores their typography.
im=Image.new('RGB',(S,150),'#ecf4ed');d=ImageDraw.Draw(im)
text(d,(256,75),'URSSAF',96,'#23425e');im.resize((S,S),Image.Resampling.LANCZOS).save(OUT/'urssaf-label.png')
im=Image.new('RGB',(S,S),'#edf5e8');d=ImageDraw.Draw(im)
for x,c in [(55,'#386fa8'),(121,'#ffffff'),(187,'#d86551')]:rounded(d,(x,44,x+66,81),4,c)
text(d,(256,169),'RÉDUCTION',55,'#31594b');text(d,(256,224),"D’IMPÔTS",58,'#31594b')
for y,w in [(291,376),(317,312),(343,342)]:line(d,[(64,y),(64+w,y)],'#a5bea9',5)
rounded(d,(186,384,445,468),18,'#78b878');text(d,(316,428),'−100%',58,'#ffffff');im.save(OUT/'impots-label.png')
im=Image.new('RGB',(S,S),'#eac956');d=ImageDraw.Draw(im)
ell(d,(29,29,483,483),'#ead169','#34443c',13)
for start in [30,150,270]:d.pieslice((81,81,431,431),start,start+60,fill='#304438')
ell(d,(177,177,335,335),'#eac956');ell(d,(210,210,302,302),'#304438');im.save(OUT/'nucleaire-label.png')
im=Image.new('RGB',(S,100),'#fff4e9');d=ImageDraw.Draw(im)
text(d,(256,50),'CARTE DE MEMBRE',42,'#a83f58');im.resize((S,S),Image.Resampling.LANCZOS).save(OUT/'socialiste-label.png')
im=Image.new('RGB',(S,S),'#f8f2df');d=ImageDraw.Draw(im)
text(d,(256,62),'M',81,'#d8ad1d');text(d,(256,117),"McDonald’s",37,'#25322c')
line(d,[(43,161),(469,161)],'#9da38a',2);text(d,(256,241),'CB12',138,'#1d302c')
text(d,(256,327),'VOTRE COMMANDE',27,'#39473c')
for y,w in [(376,381),(403,304),(430,366)]:line(d,[(66,y),(66+w,y)],'#9da38a',4)
for x in range(85,431,7):line(d,[(x,461),(x,492)],'#293c2f',3)
im.save(OUT/'cb12-label.png')
im=Image.new('RGB',(S,160),'#325044');d=ImageDraw.Draw(im)
text(d,(256,80),'85.2 FM',115,'#dcecc1');im.resize((S,S),Image.Resampling.LANCZOS).save(OUT/'radio-label.png')

print('Generated',len(colors),'512x512 textures and inventory illustrations.')
