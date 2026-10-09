"""Skybound Airworks: original low-poly asset studio, executed through Blender MCP.
Blender axes: X right, Y forward, Z up. GLB converts to X right, Y up, -Z forward.
Each asset is exported separately at the origin; the editable library is arranged in rows.
"""
import bpy, math, os, json, random
from mathutils import Vector

ROOT = r'C:\Users\hamze\Home\Desktop\Folder_1\New folder (2)'
OUT = os.path.join(ROOT, 'public', 'models')
os.makedirs(OUT, exist_ok=True)
os.makedirs(os.path.join(ROOT, 'art'), exist_ok=True)
DESELECT = next(i.identifier for i in bpy.ops.object.select_all.get_rna_type().properties['action'].enum_items if i.identifier.lower() == 'deselect')
GLB = next(i.identifier for i in bpy.ops.export_scene.gltf.get_rna_type().properties['export_format'].enum_items if i.identifier.upper() == 'GLB')
scene = bpy.data.scenes.new('Skybound Airworks — Asset Studio')
bpy.context.window.scene = scene
palette = {
    'ivory': '#F3ECD9', 'teal': '#256E74', 'dark': '#183C41', 'orange': '#EC8851',
    'yellow': '#EFC456', 'red': '#CA5346', 'blue': '#558FB5', 'glass': '#456779',
    'steel': '#83999C', 'rubber': '#2C353A', 'concrete': '#ADB6A4', 'wood': '#967554',
    'leaf': '#5A9366', 'lightleaf': '#97B56A', 'pine': '#3D7061', 'sand': '#D6B57B',
    'stone': '#88918B', 'snow': '#E6ECE5', 'pink': '#DBAD9A', 'crop': '#B9C569',
    'brick': '#B87356', 'water': '#5EADB4', 'white': '#FAFAEA', 'black': '#1D2B30',
    'purple': '#8C7CA5', 'solar': '#334D6B', 'lime': '#DBEAA6'
}
M = {}
for name, value in palette.items():
    rgb = tuple(int(value[i:i+2], 16)/255 for i in (1,3,5))
    mat = bpy.data.materials.new('Skybound_' + name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*rgb, 1)
    bsdf.inputs['Roughness'].default_value = .83
    mat.diffuse_color = (*rgb, 1)
    M[name] = mat

current = None
assets = []
def begin(name, category):
    global current
    current = bpy.data.objects.new(name, None)
    scene.collection.objects.link(current)
    current['skybound_category'] = category
    return current

def attach(obj, name, color):
    obj.name = current.name + '__' + name
    obj.parent = current
    obj.data.materials.append(M[color])
    return obj

def cube(name, loc, size, color, rot=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return attach(obj, name, color)

def cyl(name, loc, radius, depth, color, vertices=10, rot=(0,0,0), r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, radius2=r2, depth=depth, location=loc, rotation=rot)
    return attach(bpy.context.object, name, color)

def ico(name, loc, size, color, subdivisions=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=1, location=loc)
    obj=bpy.context.object
    obj.scale=size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return attach(obj, name, color)

def mesh(name, verts, faces, color):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    return attach(obj, name, color)

def beam(name, a, b, radius, color):
    a,b=Vector(a),Vector(b)
    obj=cyl(name,(a+b)/2,radius,(b-a).length,color,6)
    obj.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    return obj

def wing(name, span, chord, y, z, color, sweep=.25):
    shape=[(-span/2,y-chord*.4,z),(-span/2,y+chord*.3,z),(-.5,y+chord*.6,z),(.5,y+chord*.6,z),(span/2,y+chord*.3,z),(span/2,y-chord*.4,z),(.5,y-chord*.55,z),(-.5,y-chord*.55,z)]
    verts=[(x,yy-abs(x)*sweep,zz+dz) for dz in (-.1,.1) for x,yy,zz in shape]
    return mesh(name,verts,[tuple(range(7,-1,-1)),tuple(range(8,16))]+[(i,(i+1)%8,(i+1)%8+8,i+8) for i in range(8)],color)

def roof(name, width, length, z, color):
    return mesh(name,[(-width/2,-length/2,z), (width/2,-length/2,z), (width/2,length/2,z),(-width/2,length/2,z),(0,-length/2,z+width*.26),(0,length/2,z+width*.26)],[(0,1,4),(3,5,2),(0,4,5,3),(4,1,2,5),(0,3,2,1)],color)

def export_asset():
    bpy.ops.object.select_all(action=DESELECT)
    children=list(current.children_recursive)
    for obj in [current]+children: obj.select_set(True)
    bpy.context.view_layer.objects.active=current
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,current.name+'.glb'),export_format=GLB,use_selection=True,export_animations=False,export_cameras=False,export_lights=False)
    verts=sum(len(o.data.vertices) for o in children if o.type=='MESH')
    polys=sum(len(o.data.polygons) for o in children if o.type=='MESH')
    assets.append({'id':current.name,'category':current['skybound_category'],'file':current.name+'.glb','meshes':len(children),'vertices':verts,'faces':polys})
    idx=len(assets)-1
    current.location=(idx%10*52,idx//10*55,0)

def propeller(x,y,z,scale=1):
    hub=cyl('Propeller_hub',(x,y,z),.23*scale,.26*scale,'steel',10,(math.pi/2,0,0))
    blade=cube('Propeller_blades',(x,y+.16*scale,z),(.17*scale,.12*scale,2.6*scale),'rubber')
    tip=cube('Propeller_tips',(x,y+.16*scale,z+1.15*scale),(.18*scale,.13*scale,.28*scale),'yellow')
    for obj in (blade,tip):
        world=obj.matrix_world.copy()
        obj.parent=hub
        obj.matrix_world=world

def airplane(name, length, span, color, engines=1, high=True, floats=False, kind='cargo'):
    begin(name,'aircraft')
    z=1.8 if not floats else 2.4
    widths=[.08,.38,.85,.95,.6,.22]
    rings=[-.52,-.35,-.1,.16,.37,.5]
    verts=[]
    for yy,ww in zip(rings,widths):
        for i in range(8):
            a=2*math.pi*i/8
            verts.append((math.cos(a)*ww*length*.105,yy*length,z+math.sin(a)*ww*length*.1))
    faces=[tuple(range(7,-1,-1))]
    for j in range(5):
        for i in range(8): faces.append((j*8+i,j*8+(i+1)%8,(j+1)*8+(i+1)%8,(j+1)*8+i))
    faces.append(tuple(range(40,48)))
    mesh('faceted_fuselage',verts,faces,'ivory')
    cube('signature_stripe',(0,0,z+.02),(length*.19,length*.69,.23),color)
    ico('cockpit_canopy',(0,length*.2,z+length*.062),(length*.096,length*.145,length*.065),'glass',1)
    cube('windshield_frame',(0,length*.31,z+length*.063),(length*.185,.09,.1),'ivory')
    wz=z+length*.067 if high else z-length*.045
    wing('main_wings',span,length*.22,length*.02,wz,color,.075)
    wing('tailplane',span*.35,length*.12,-length*.41,z+length*.036,color,.02)
    mesh('vertical_tail',[(0,-length*.48,z),(0,-length*.29,z),(0,-length*.4,z+length*.23),(.13,-length*.48,z),(.13,-length*.29,z),(.13,-length*.4,z+length*.23)],[(0,1,2),(3,5,4),(0,3,4,1),(1,4,5,2),(2,5,3,0)],color)
    if high:
        for sx in (-1,1): beam('wing_strut',(sx*length*.07,length*.02,z-.25),(sx*span*.32,length*.02,wz),.06,'steel')
    if engines==1:
        cyl('engine_nose',(0,length*.47,z),length*.065,length*.11,color,10,(math.pi/2,0,0))
        propeller(0,length*.54,z,length*.11)
    else:
        xs=[-span*.22,span*.22] if engines==2 else [-span*.32,-span*.15,span*.15,span*.32]
        for x in xs:
            ico('engine_nacelle',(x,length*.065,wz-.17),(length*.046,length*.18,length*.05),color,1)
            propeller(x,length*.25,wz-.17,length*.09)
    if floats:
        for sx in (-1,1):
            ico('pontoon',(sx*length*.09,0,.5),(length*.055,length*.49,.45),'steel',1)
            for yy in (-.17,.17): beam('float_strut',(sx*length*.09,length*yy,.75),(sx*length*.07,length*yy,z-.35),.065,'dark')
    else:
        for x,yy in [(-length*.11,length*.015),(length*.11,length*.015),(0,-length*.39)]:
            beam('undercarriage',(x,yy,.45),(x*.7,yy,z-.4),.075,'steel')
            cyl('wheel',(x,yy,.42),.42,.22,'rubber',10,(0,math.pi/2,0))
            cyl('wheel_hub',(x+.12,yy,.42),.2,.025,'steel',8,(0,math.pi/2,0))
    for yy in (-.18,-.05):
        for sx in (-1,1): cube('cabin_window',(sx*length*.086,yy*length,z+length*.025),(.04,length*.055,length*.045),'glass')
    cube('cargo_door',(-length*.088,-length*.13,z-.16),(.045,length*.14,length*.105),'steel')
    for sx,c in [(-1,'red'),(1,'leaf')]: ico('navigation_light',(sx*span*.48,0,wz),(.13,.15,.13),c)
    if kind=='medical':
        for sx in (-1,1):
            cube('medical_cross_vertical',(sx*length*.09,-length*.21,z),(.05,.24,.8),'red')
            cube('medical_cross_horizontal',(sx*length*.09,-length*.21,z),(.06,.75,.24),'red')
    if kind=='fire':
        ico('water_tank',(0,-length*.1,z-.4),(length*.08,length*.22,.65),'yellow',1)
        cube('water_release_gate',(0,-length*.12,z-.99),(length*.13,length*.14,.09),'red')
    if kind=='farm':
        for sx in (-1,1):
            beam('spray_bar',(sx*.8,-.6,z-.8),(sx*span*.43,-.6,z-.8),.065,'dark')
            for xx in range(1,int(span*.4)):
                cyl('spray_nozzle',(sx*xx,-.6,z-.89),.07,.16,'yellow',6)
        ico('chemical_hopper',(0,-length*.13,z+.38),(.8,1.15,.55),'yellow',1)
    if kind=='survey':
        ico('camera_pod',(0,.2,z-.8),(.5,.7,.6),'dark',1)
        cyl('lens',(0,.2,z-1.25),.22,.13,'blue',10)
        beam('antenna',(0,-length*.2,z+.55),(0,-length*.2,z+1.4),.045,'steel')
    if kind=='tour':
        for yy in (-.26,-.15,-.04):
            for sx in (-1,1): cube('panorama_window',(sx*length*.09,length*yy,z+.07),(.05,length*.075,length*.065),'glass')
    export_asset()

def helicopter():
    begin('rescue_helicopter','aircraft')
    ico('rescue_cabin',(0,.4,2.2),(1.3,2.1,1.25),'orange',2)
    ico('panoramic_glass',(0,1.6,2.45),(1.1,1.3,.85),'glass',1)
    beam('tail_boom',(0,-1,2.2),(0,-5.7,2.75),.27,'ivory')
    cube('tail_fin',(0,-5.2,3.1),(.15,1.1,1.6),'orange',(.2,0,0))
    for sx in (-1,1):
        beam('skid',(sx*1.25,-1.7,.22),(sx*1.25,2.1,.22),.1,'steel')
        for y in (-1,1): beam('skid_support',(sx*1.25,y,.22),(sx*.6,y,1.4),.08,'steel')
    cyl('rotor_mast',(0,0,3.7),.16,1.1,'steel')
    rotor=cube('Rotor_main',(0,0,4.3),(9.5,.25,.09),'rubber')
    b=cube('Rotor_cross',(0,0,4.3),(.25,9.5,.09),'rubber')
    world=b.matrix_world.copy(); b.parent=rotor; b.matrix_world=world
    cyl('Rotor_tail',(0,-5.6,3),.6,.1,'rubber',6,(0,math.pi/2,0))
    cube('medical_cross_vertical',(-1.27,-.5,2.5),(.05,.25,.8),'white')
    cube('medical_cross_horizontal',(-1.28,-.5,2.5),(.05,.8,.25),'white')
    cyl('winch',(1.25,-.5,2),.25,.38,'dark',8,(0,math.pi/2,0))
    export_asset()

def build_aircraft():
    airplane('courier_starter',7.8,10.5,'teal')
    airplane('courier_twin',12.2,16,'blue',2)
    airplane('medical_turboprop',11,14,'red',2,kind='medical')
    airplane('fire_waterbomber',16,22,'yellow',2,floats=True,kind='fire')
    airplane('agricultural_duster',8.8,12.5,'yellow',1,False,kind='farm')
    airplane('tour_floatplane',9.8,13.5,'orange',1,floats=True,kind='tour')
    airplane('survey_scout',8.5,11.8,'purple',1,kind='survey')
    helicopter()
    airplane('heavy_freighter',23,29,'teal',4)
    airplane('tour_airliner',20,25,'blue',2,False,kind='tour')
    print('Aircraft authored and exported:', len(assets))

def windows(width,length,z,step=3):
    for x in range(-int(width/2)+2,int(width/2),step):
        for yy in (-length/2-.025,length/2+.025): cube('window',(x,yy,z),(1.5,.06,1.6),'glass')

def hangar(name,width,length,color):
    begin(name,'headquarters')
    cube('foundation',(0,0,.15),(width+2,length+2,.3),'concrete')
    for sx in (-1,1): cube('side_wall',(sx*(width/2-.25),0,3.6),(.5,length,7.2),color)
    cube('back_wall',(0,-length/2+.2,3.6),(width,.4,7.2),color)
    roof('pitched_roof',width+1,length+1,7.2,'dark')
    cube('door_header',(0,length/2,6.9),(width,.5,1.3),'ivory')
    for sx in (-1,1): cube('door_track',(sx*(width/2-.4),length/2,3.3),(.24,.3,6.6),'steel')
    for yy in range(-int(length/2)+2,int(length/2),3):
        for sx in (-1,1): cube('corrugation',(sx*(width/2+.02),yy,3.5),(.06,.15,6.8),'steel')
    cube('hangar_sign',(0,length/2+.3,7),(width*.36,.12,.85),'orange')
    windows(width,length,4.5,5)
    export_asset()

def building(name,w,d,h,color='ivory',category='headquarters',roof_type='flat'):
    begin(name,category)
    cube('plinth',(0,0,.18),(w+1,d+1,.36),'concrete')
    cube('walls',(0,0,h/2+.35),(w,d,h),color)
    if roof_type=='pitched': roof('roof',w+.6,d+.6,h+.4,'dark')
    else: cube('roof',(0,0,h+.4),(w+.6,d+.6,.3),'dark')
    windows(w,d,h*.64,max(3,int(w/5)))
    cube('front_door',(0,d/2+.04,1.6),(1.7,.1,2.6),'glass')

def build_facilities():
    hangar('hangar_small',18,18,'teal')
    hangar('hangar_large',34,25,'blue')
    building('dispatch_office',13,10,4,'ivory')
    cube('awning',(0,5.8,3.9),(8,2,.25),'orange')
    cube('sign',(0,5.18,3.6),(8,.2,.6),'teal')
    for x in (-4,4): cyl('plant_pot',(x,6.5,.45),.55,.8,'brick'); ico('plant',(x,6.5,1.3),(.7,.7,1),'leaf')
    export_asset()
    begin('control_tower','headquarters')
    cube('tower_base',(0,0,5),(5,5,10),'ivory')
    cube('observation_deck',(0,0,11),(8,8,2.2),'glass')
    cube('deck_roof',(0,0,12.3),(8.8,8.8,.4),'teal')
    for sx in (-1,1):
        for sy in (-1,1): cube('window_frame',(sx*3.8,sy*3.8,11.1),(.18,.18,2.4),'ivory')
    cyl('aerial',(0,0,14),.1,3,'steel')
    export_asset()
    begin('fuel_depot','headquarters')
    cube('pad',(0,0,.15),(14,12,.3),'concrete')
    for x in (-3,3):
        cyl('fuel_tank',(x,-1,2.7),2.1,5,'ivory',12)
        cyl('tank_cap',(x,-1,5.3),2.2,.2,'teal',12)
        cube('warning_band',(x,-1,2.9),(4.23,4.23,.2),'orange')
    cube('pump',(0,5,1),(1.4,1,2),'teal')
    beam('hose',(1,5,1.6),(2,5,.4),.1,'rubber')
    export_asset()
    building('maintenance_shop',17,13,5,'steel',roof_type='pitched')
    cube('garage_door',(0,6.57,2.4),(7,.12,4.2),'teal')
    cube('toolbench',(5,7,.6),(3,1,1.2),'orange')
    export_asset()
    building('cargo_warehouse',22,17,6,'brick',roof_type='pitched')
    for x in (-5,5): cube('loading_door',(x,8.58,2.6),(6,.1,4.8),'steel')
    cube('loading_dock',(0,10,.6),(20,3,1.2),'concrete')
    export_asset()
    building('medical_station',15,12,4.5,'ivory')
    cube('cross_v',(0,6.12,3.6),(.3,.12,1.2),'red'); cube('cross_h',(0,6.14,3.6),(1.2,.12,.3),'red')
    cube('canopy',(0,7,3.3),(5,2,.15),'red')
    export_asset()
    begin('fire_response_station','headquarters')
    cube('station',(0,0,3),(20,14,6),'red')
    cube('roof',(0,0,6.1),(21,15,.3),'dark')
    for x in (-5,5): cube('bay_door',(x,7.1,2.7),(7,.12,5),'ivory')
    cyl('water_reservoir',(13,0,3),3,6,'blue',12)
    export_asset()
    building('tour_terminal',21,14,5,'sand')
    cube('glazed_front',(0,7.1,3),(18,.1,3.5),'glass')
    cube('terminal_canopy',(0,9,4.5),(23,4,.2),'orange')
    for x in (-9,9): beam('canopy_pillar',(x,10,0),(x,10,4.5),.1,'steel')
    export_asset()
    begin('agricultural_store','headquarters')
    cube('shed',(0,0,2.5),(13,12,5),'yellow'); roof('roof',14,13,5,'dark')
    for x in (-4,4): cyl('chemical_tank',(x,8,1.5),1.2,3,'ivory',10)
    cube('front_gate',(0,6.1,2),(5,.12,3.5),'teal')
    export_asset()
    begin('helipad','headquarters')
    cyl('landing_pad',(0,0,.18),10,.35,'concrete',12)
    for x in (-2,2): cube('H_sides',(x,0,.38),(1,7,.04),'yellow')
    cube('H_crossbar',(0,0,.38),(4,1,.04),'yellow')
    for i in range(8):
        a=i*math.pi/4; ico('pad_light',(math.cos(a)*9,math.sin(a)*9,.55),(.2,.2,.25),'orange')
    export_asset()
    begin('radar_station','headquarters')
    cube('radar_base',(0,0,2.5),(7,7,5),'ivory')
    cyl('mast',(0,0,6),.6,3,'steel')
    ico('radar_dish',(0,0,8.3),(4,1,2.8),'teal',2)
    beam('dish_feed',(0,1,8),(0,3.5,8),.12,'orange')
    export_asset()
    begin('apron_stand','headquarters')
    cube('parking_surface',(0,0,.08),(26,26,.16),'concrete')
    for x in (-10,10): cube('stand_edge',(x,0,.17),(.13,24,.02),'yellow')
    cube('stand_center',(0,-3,.18),(.16,15,.02),'yellow')
    cube('stand_stop',(0,4,.18),(6,.2,.02),'yellow')
    export_asset()
    begin('solar_canopy','headquarters')
    for sx in (-1,1):
        for sy in (-1,1): cube('support',(sx*6,sy*5,2.5),(.3,.3,5),'steel')
    for i in range(6): cube('solar_panel',(-5+i*2,0,5.2),(1.85,11,.18),'solar',(.08,0,0))
    export_asset()
    print('Facilities exported; running asset count:',len(assets))

def tree(name,kind):
    begin(name,'nature')
    if kind=='palm':
        beam('trunk',(0,0,0),(.6,0,6.7),.3,'wood')
        for i in range(7):
            a=i*math.pi*2/7
            mesh('palm_frond',[(.6,0,6.8),(math.cos(a+.2)*2+.6,math.sin(a+.2)*2,7.5),(math.cos(a)*4+.6,math.sin(a)*4,5.9),(math.cos(a-.2)*2+.6,math.sin(a-.2)*2,7.1)],[(0,1,2),(0,2,3)],'leaf' if i%2 else 'lightleaf')
    elif kind=='pine':
        cyl('trunk',(0,0,2.5),.28,5,'wood',6)
        for i in range(3): cyl('evergreen_tier',(0,0,3.5+i*1.6),2.5-i*.45,3.2,'pine' if i%2 else 'leaf',7,r2=0)
    else:
        cyl('trunk',(0,0,2),.34,4,'wood',7)
        for x,y,z,s in [(0,0,4.9,2.8),(-1,0,4,1.8),(1,.6,4.4,2)]: ico('leaf_crown',(x,y,z),(s,s,s*.8),'leaf' if kind=='oak' else 'orange',1)
    export_asset()

def build_environment():
    for name,kind in [('tree_oak','oak'),('tree_pine','pine'),('tree_palm','palm'),('tree_autumn','autumn')]: tree(name,kind)
    begin('cactus','nature')
    cyl('stem',(0,0,1.8),.33,3.6,'pine',7)
    for sx,zz in [(-1,2),(1,2.7)]:
        beam('arm',(0,0,zz),(sx*.9,0,zz),.21,'pine'); cyl('arm_tip',(sx*.9,0,zz+.4),.21,.9,'pine',7)
    export_asset()
    for name,c,size in [('rock_boulder','stone',(4,3,2.5)),('rock_desert','sand',(5,3,4)),('rock_snow','snow',(4,4,3)),('rock_coastal','dark',(5,4,2))]:
        begin(name,'nature'); ico('rock',(0,0,size[2]*.6),size,c,1); export_asset()
    begin('wind_turbine','landmark')
    cyl('tower',(0,0,12),1,24,'ivory',8,r2=.5)
    ico('nacelle',(0,0,24),(.8,1.8,.8),'teal')
    for i in range(3):
        a=i*math.pi*2/3
        beam('turbine_blade',(0,1.8,24),(math.sin(a)*8,1.8,24+math.cos(a)*8),.3,'ivory')
    export_asset()
    begin('lighthouse','landmark')
    cyl('tower',(0,0,9),3,18,'ivory',10,r2=2)
    cyl('red_band',(0,0,11),2.55,2,'red',10)
    cyl('lantern',(0,0,19),2.1,2,'glass',10)
    cyl('cap',(0,0,21),3,2,'teal',10,r2=0)
    export_asset()
    begin('water_tower','landmark')
    for x in (-2,2):
        for y in (-2,2): beam('leg',(x,y,0),(x,y,9),.15,'steel')
    cyl('water_tank',(0,0,10),3.5,4,'blue',10)
    cyl('cap',(0,0,12.5),3.6,1,'dark',10,r2=0)
    export_asset()
    begin('radio_mast','landmark')
    for x,y in [(-1,-1),(1,-1),(0,1)]: beam('pylon',(x,y,0),(0,0,25),.15,'steel')
    for z in range(3,25,3): cube('antenna',(0,0,z),(4,.15,.15),'red')
    export_asset()
    for name,w,d,h,color,rt in [('town_house',8,8,4,'pink','pitched'),('town_house_teal',7,9,4,'teal','pitched'),('farm_barn',14,20,6,'red','pitched'),('farm_house',11,9,5,'ivory','pitched'),('desert_adobe',9,8,4,'sand','flat'),('island_bungalow',8,7,3,'wood','pitched'),('mountain_cabin',9,8,4,'wood','pitched'),('city_midrise',16,14,23,'ivory','flat'),('city_tower',18,18,47,'blue','flat'),('city_office',24,18,31,'steel','flat'),('resort_hotel',30,18,13,'pink','flat'),('hospital',30,22,11,'ivory','flat'),('factory',32,24,12,'brick','flat'),('airport_terminal',40,22,9,'ivory','flat')]:
        building(name,w,d,h,color,'settlement',rt)
        if name.startswith('city') or name in ('hospital','resort_hotel'):
            for zz in range(7,int(h),4): windows(w,d,zz,4)
        if name=='hospital':
            cube('medical_cross_v',(0,d/2+.15,h-1),(.7,.2,3),'red'); cube('medical_cross_h',(0,d/2+.16,h-1),(3,.2,.7),'red')
        if name=='factory': cyl('chimney',(w/2-3,0,13),1.6,26,'steel',10)
        export_asset()
    begin('crop_patch','nature')
    cube('soil',(0,0,.05),(12,14,.1),'wood')
    for x in range(-5,6,2):
        cube('crop_row',(x,0,.45),(.75,13,.8),'crop')
    export_asset()
    begin('orchard_tree','nature')
    cyl('trunk',(0,0,1.2),.18,2.4,'wood',6); ico('crown',(0,0,3),(1.8,1.8,1.9),'leaf',1)
    for p in [(-1,0,3),(1,.7,3.5),(0,-1,2.8)]: ico('fruit',p,(.18,.18,.18),'orange')
    export_asset()
    begin('cargo_pallet','prop')
    cube('pallet',(0,0,.14),(2,1.6,.28),'wood')
    for x in (-.5,.5):
        for y in (-.4,.4): cube('parcel',(x,y,.7),(.94,.74,.9),'sand')
    cube('strap',(0,0,1.16),(2,.06,.025),'dark')
    export_asset()
    begin('fuel_truck','vehicle')
    cube('chassis',(0,0,.65),(2.6,6,.4),'steel'); cube('cab',(0,2,1.7),(2.5,2,2.3),'teal'); cube('windscreen',(0,3.04,2),(2.15,.05,1),'glass')
    cyl('tanker',(0,-1,1.9),1.1,3.8,'ivory',10,(math.pi/2,0,0))
    for x in (-1.3,1.3):
        for y in (-2,1.8): cyl('wheel',(x,y,.6),.6,.3,'rubber',8,(0,math.pi/2,0))
    export_asset()
    begin('ambulance','vehicle')
    cube('vehicle_body',(0,0,1.2),(2.4,5,1.8),'ivory'); cube('cab',(0,1.7,1.9),(2.4,1.5,1),'ivory'); cube('glass',(0,2.46,2),(2.1,.07,.8),'glass')
    for sx in (-1,1):
        for y in (-1.7,1.6): cyl('wheel',(sx*1.21,y,.45),.45,.22,'rubber',8,(0,math.pi/2,0))
        cube('cross_v',(sx*1.23,-.6,1.5),(.06,.23,.9),'red'); cube('cross_h',(sx*1.24,-.6,1.5),(.06,.9,.23),'red')
    cube('siren',(0,.2,2.2),(1.2,.3,.25),'blue')
    export_asset()
    begin('tractor','vehicle')
    cube('hood',(0,1,1.1),(1.6,2,1.2),'leaf'); cube('cab',(0,-.5,1.6),(1.7,1.4,2),'glass'); cube('roof',(0,-.5,2.7),(2,1.8,.18),'leaf')
    for sx in (-1,1):
        for y,r in [(-.6,.9),(1.5,.48)]: cyl('tyre',(sx*1.02,y,r),r,.35,'rubber',10,(0,math.pi/2,0))
    export_asset()
    begin('fishing_boat','vehicle')
    ico('hull',(0,0,.6),(1.8,4,.8),'ivory',1); cube('cabin',(0,-.2,1.7),(2.4,2.3,1.8),'teal'); cube('cabin_glass',(0,1,2),(2,.1,1),'glass')
    cyl('mast',(0,-1,3),.08,4,'wood',6)
    export_asset()
    begin('shipping_container','prop')
    cube('container',(0,0,1.3),(2.6,6,2.6),'orange')
    for yy in range(-2,3):
        for sx in (-1,1): cube('rib',(sx*1.33,yy,1.3),(.05,.12,2.5),'ivory')
    export_asset()
    begin('windsock','prop')
    cyl('pole',(0,0,3),.08,6,'steel',6)
    for i in range(4): cyl('sock_band',(0,i*.4+.2,6),.42-i*.07,.42,'orange' if i%2==0 else 'ivory',8,(math.pi/2,0,0))
    export_asset()
    begin('runway_light','prop')
    cyl('mount',(0,0,.3),.15,.6,'steel',6); ico('light',(0,0,.64),(.22,.22,.18),'yellow')
    export_asset()
    begin('fence_section','prop')
    for x in (-2,2): cube('post',(x,0,1),(.12,.12,2),'wood')
    for z in (.7,1.5): cube('rail',(0,0,z),(4.1,.1,.13),'ivory')
    export_asset()
    begin('bush','nature'); ico('shrub',(0,0,.9),(1.5,1.3,1.2),'lightleaf',1); export_asset()
    begin('rescue_camp','prop')
    roof('tent',3,4,0,'orange'); cube('groundsheet',(0,0,.04),(3,4,.08),'dark'); cube('rescue_beacon',(2,0,.5),(.4,.4,1),'yellow')
    export_asset()
    print('Environment exported; running asset count:',len(assets))

def finish():
    with open(os.path.join(OUT,'manifest.json'),'w',encoding='utf-8') as f:
        json.dump({'title':'Skybound Airworks original Blender MCP kit','authoring':'Live Blender MCP / original procedural meshes','count':len(assets),'assets':assets},f,indent=2)
    world=bpy.data.worlds.new('Skybound studio sky'); world.use_nodes=True
    next(n for n in world.node_tree.nodes if n.type=='BACKGROUND').inputs['Color'].default_value=(.55,.72,.74,1)
    scene.world=world
    bpy.ops.object.light_add(type='AREA',location=(160,140,170))
    light=bpy.context.object; light.name='Skybound_Studio_Key'; light.data.energy=50000; light.data.shape='DISK'; light.data.size=160
    bpy.ops.object.camera_add(location=(230,-350,330))
    cam=bpy.context.object; cam.name='Skybound_Studio_Camera'; cam.rotation_euler=(Vector((210,130,0))-cam.location).to_track_quat('-Z','Y').to_euler(); cam.data.type='ORTHO'; cam.data.ortho_scale=630; scene.camera=cam
    scene.render.resolution_x=1600; scene.render.resolution_y=1000
    bpy.data.libraries.write(os.path.join(ROOT,'art','skybound-models.blend'),{scene},fake_user=True,compress=True)
    bpy.ops.object.select_all(action=DESELECT)
    print(json.dumps({'assets':len(assets),'mesh_objects':sum(a['meshes'] for a in assets),'vertices':sum(a['vertices'] for a in assets),'editable_source':'art/skybound-models.blend'}))
