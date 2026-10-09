"""Skybound expansion kit. Run inside the user's live Blender through Blender MCP."""
import bpy, math, os, json, contextlib, io, io_scene_gltf2
from mathutils import Vector

ROOT = r'C:\Users\hamze\Home\Desktop\Folder_1\New folder (2)'
OUT = os.path.join(ROOT, 'public', 'models')
scene = bpy.data.scenes.new('Skybound — Regional Expansion Studio')
bpy.context.window.scene = scene
palette = {'cream':'F3ECD9','teal':'256E74','dark':'183C41','orange':'EC8851','yellow':'EFC456','red':'CA5346','steel':'83999C','glass':'456779','rubber':'2C353A','concrete':'ADB6A4','wood':'967554','skin':'DBAD9A','blue':'558FB5','white':'FAFAEA'}
materials = {}
for key, value in palette.items():
    mat = bpy.data.materials.new('SkyboundExpansion_' + key)
    mat.use_nodes = True
    color = tuple(int(value[i:i+2], 16)/255 for i in (0,2,4))
    shader = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = .78
    mat.diffuse_color = (*color, 1)
    materials[key] = mat
root = None
assets = []
deselect = next(i.identifier for i in bpy.ops.object.select_all.get_rna_type().properties['action'].enum_items if i.identifier.lower() == 'deselect')
format_items = io_scene_gltf2.ExportGLTF2_Base.__annotations__['export_format'].keywords['items'](None,bpy.context)
glb = next(item[0] for item in format_items if 'binary' in item[1].lower())

def begin(name):
    global root
    root = bpy.data.objects.new(name, None)
    scene.collection.objects.link(root)
    root['asset_id'] = name

def attach(obj, name, material, parent=None):
    obj.name = root['asset_id'] + '__' + name
    obj.parent = parent or root
    obj.data.materials.append(materials[material])
    return obj

def cube(name, loc, size, material, rot=(0,0,0), parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return attach(obj,name,material,parent)

def cylinder(name, loc, radius, depth, material, rot=(0,0,0), vertices=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=loc,rotation=rot)
    return attach(bpy.context.object,name,material)

def beam(name, a, b, radius, material):
    a,b=Vector(a),Vector(b)
    obj=cylinder(name,(a+b)/2,radius,(b-a).length,material,vertices=6)
    obj.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    return obj

def text(name, label, loc, size, material):
    data=bpy.data.curves.new(name,'FONT');data.body=label;data.align_x='CENTER';data.size=size;data.extrude=.018
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj)
    obj.location=loc;obj.rotation_euler=(math.pi/2,0,0)
    attach(obj,name,material)
    bpy.context.view_layer.objects.active=obj;obj.select_set(True)
    bpy.ops.object.convert(target='MESH');obj.select_set(False)

def shell(width, depth, height, color='cream'):
    cube('foundation',(0,0,.2),(width+1,depth+1,.4),'concrete')
    cube('rear_wall',(0,depth/2,height/2),(width,.35,height),color)
    for x in [-1,1]:cube('side_wall',(x*width/2,0,height/2),(.35,depth,height),color)
    cube('roof',(0,0,height+.25),(width+1.4,depth+1.4,.5),'dark')

def export():
    bpy.ops.object.select_all(action=deselect)
    objects=[root]+list(root.children_recursive)
    for obj in objects:obj.select_set(True)
    bpy.context.view_layer.objects.active=root
    asset_id=root['asset_id']
    with contextlib.redirect_stdout(io.StringIO()):
        bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,asset_id+'.glb'),export_format=glb,use_selection=True,export_animations=False,export_cameras=False,export_lights=False)
    meshes=[o for o in objects if o.type=='MESH']
    assets.append({'id':asset_id,'category':'regional-expansion','file':asset_id+'.glb','meshes':len(meshes),'vertices':sum(len(o.data.vertices) for o in meshes),'faces':sum(len(o.data.polygons) for o in meshes)})
    root.location=((len(assets)-1)%4*32, (len(assets)-1)//4*32, 0)

def build():
    begin('branch_terminal');shell(21,13,6)
    cube('front_glazing',(0,-6.5,2.7),(19,.3,4.7),'glass')
    for x in [-8,-4,0,4,8]:cube('window_mullion',(x,-6.72,2.7),(.15,.15,4.7),'cream')
    cube('door',(0,-6.85,1.7),(2.4,.15,3.4),'teal')
    cube('awning',(0,-9,4.6),(22,5,.2),'orange')
    for x in [-9.5,9.5]:cylinder('awning_post',(x,-10.8,2.25),.12,4.5,'steel')
    for x in [-6,6]:
        cube('bench',(x,-8.5,.8),(3.4,.7,.2),'wood')
        for xx in [-1,1]:cube('bench_leg',(x+xx*1.2,-8.5,.4),(.15,.4,.8),'dark')
    cube('terminal_sign',(0,-6.85,5.55),(16,.2,.8),'teal')
    text('terminal_letters','SKYBOUND  /  TERMINAL',(0,-7,5.27),.52,'cream')
    export()

    begin('branch_hangar');shell(27,22,10,'teal')
    for x in [-1,1]:cube('door_rail',(x*13.3,-11,5),(.45,.45,10),'steel')
    cube('door_header',(0,-11,9.35),(26.7,.5,1.3),'cream')
    for x in [-11,11]:cube('folded_door',(x,-11.3,4.5),(3,.4,8.5),'steel')
    for x in range(-12,13,3):cube('roof_seam',(x,0,10.55),(.09,23,.06),'steel')
    cube('service_table',(8,7,1),(5,2,.2),'wood')
    for x in [-1,1]:cube('table_leg',(8+x*2,7,.5),(.15,.15,1),'steel')
    text('hangar_letters','SKYBOUND',(0,-11.3,9.1),.62,'teal')
    export()

    begin('branch_depot')
    cube('tank_pad',(0,0,.2),(17,12,.4),'concrete')
    for x in [-4,4]:
        cylinder('fuel_tank',(x,0,3.2),2.8,7,'cream',(math.pi/2,0,0),16)
        for y in [-2.5,2.5]:cube('tank_saddle',(x,y,1.1),(5.5,.5,2),'teal')
        cylinder('top_hatch',(x,0,6.05),.55,.2,'steel')
        for y in [-3,0,3]:cube('tank_band',(x,y,3.3),(5.75,.12,.2),'orange')
    cube('pump',(0,-5,1.5),(1.7,1.1,3),'teal');cube('meter',(0,-5.58,2),(1,.08,.65),'glass')
    for side in [-1,1]:beam('hose',(side*.8,-5,1.7),(side*1.65,-5.4,.35),.09,'rubber')
    export()

    begin('branch_warehouse');shell(20,16,7,'cream')
    cube('front_wall',(0,-8,3.5),(20,.3,7),'cream')
    cube('cargo_door',(0,-8.3,2.5),(8,.25,5),'teal')
    for z in range(1,5):cube('door_slat',(0,-8.45,z),(8,.06,.06),'steel')
    cube('loading_dock',(0,-11,.5),(14,6,1),'concrete')
    for x in [-6,6]:cube('dock_bumper',(x,-14,.65),(.5,.35,1),'rubber')
    for x,y,z in [(-6,-11,1.7),(-4,-11,1.7),(-6,-11,3),(5,-11,1.7)]:
        cube('freight_crate',(x,y,z),(1.7,1.5,1.2),'wood')
        cube('crate_band',(x,y,z),(1.75,.13,1.25),'teal')
    text('warehouse_letters','REGIONAL FREIGHT',(0,-8.5,5.7),.62,'dark')
    export()

    begin('branch_sign')
    for x in [-2.5,2.5]:cube('signpost',(x,0,2.8),(.22,.22,5.6),'steel')
    cube('signboard',(0,0,4.5),(6.8,.35,2.2),'teal')
    text('company_letters','SKYBOUND',(0,-.2,4.6),.72,'cream')
    text('base_letters','REGIONAL AIRWORKS',(0,-.2,4.05),.29,'yellow')
    export()

    for name,coat in [('ground_crew','yellow'),('airport_passenger','blue')]:
        begin(name)
        cube('Torso',(0,0,1.15),(.5,.32,.6),coat)
        cylinder('Neck',(0,0,1.5),.085,.15,'skin')
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.2,location=(0,0,1.7));attach(bpy.context.object,'Head','skin')
        if name=='ground_crew':
            cylinder('Helmet',(0,0,1.85),.225,.13,'orange')
            for z in [1.06,1.28]:cube('HiVis_band',(0,-.17,z),(.51,.025,.065),'cream')
        else:
            cube('Backpack',(0,.25,1.12),(.38,.25,.48),'orange')
            cube('Luggage',(.47,0,.4),(.27,.22,.42),'teal')
        for side,suffix in [(-1,'L'),(1,'R')]:
            pivot=bpy.data.objects.new(name+'__Leg_'+suffix,None);scene.collection.objects.link(pivot);pivot.parent=root;pivot.location=(side*.14,0,.88)
            cube('Shin_'+suffix,(0,0,-.34),(.18,.2,.66),'dark',parent=pivot)
            cube('Boot_'+suffix,(0,-.06,-.73),(.21,.33,.14),'rubber',parent=pivot)
            arm=bpy.data.objects.new(name+'__Arm_'+suffix,None);scene.collection.objects.link(arm);arm.parent=root;arm.location=(side*.32,0,1.39)
            cube('Sleeve_'+suffix,(0,0,-.2),(.16,.2,.4),coat,parent=arm)
            cube('Hand_'+suffix,(0,0,-.45),(.14,.15,.16),'skin',parent=arm)
        export()

    begin('baggage_cart')
    cube('platform',(0,0,.55),(1.7,3.1,.2),'steel')
    for x in [-.9,.9]:
        for y in [-1,1]:cylinder('wheel',(x,y,.35),.35,.18,'rubber',(0,math.pi/2,0))
    for x in [-.75,.75]:
        for y in [-1.4,1.4]:cube('rail_post',(x,y,1.04),(.09,.09,1),'steel')
        cube('side_rail',(x,0,1.48),(.1,3,.1),'teal')
    beam('towbar',(0,-1.5,.6),(0,-3,.35),.07,'steel')
    for i in range(4):
        cube('supply_box',((i%2-.5)*.7,(i//2-.5)*1.1,1),(.65,.85,.65),'wood' if i<2 else 'cream')
        if i>=2:
            cube('medical_cross',((i%2-.5)*.7,-.56+(i//2-.5)*1.1,1),(.12,.04,.38),'red')
            cube('medical_cross_arm',((i%2-.5)*.7,-.59+(i//2-.5)*1.1,1),(.38,.04,.12),'red')
    export()

    manifest_path=os.path.join(OUT,'manifest.json')
    with open(manifest_path,encoding='utf-8') as handle:manifest=json.load(handle)
    ids={a['id'] for a in assets}
    manifest['assets']=[a for a in manifest['assets'] if a['id'] not in ids]+assets
    manifest['count']=len(manifest['assets'])
    with open(manifest_path,'w',encoding='utf-8') as handle:json.dump(manifest,handle,indent=2)
    for obj in bpy.context.selected_objects:obj.select_set(False)
    bpy.ops.object.light_add(type='SUN',location=(20,-20,45));sun=bpy.context.object;sun.rotation_euler=(.4,-.4,-.4);sun.data.energy=3
    scene.world=bpy.data.worlds.new('Expansion studio daylight');scene.world.use_nodes=True
    next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND').inputs['Color'].default_value=(.6,.75,.75,1)
    next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND').inputs['Strength'].default_value=.7
    bpy.ops.object.camera_add(location=(105,-118,105));camera=bpy.context.object;camera.rotation_euler=(Vector((45,13,1))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=143;scene.camera=camera
    scene.render.resolution_x=1400;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'art','skybound-expansion.blend'))
    print(json.dumps({'exported':len(assets),'manifest_count':manifest['count'],'vertices':sum(a['vertices'] for a in assets),'assets':[a['id'] for a in assets]}))

build()
