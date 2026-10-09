"""Render the original aircraft for in-game market cards, in live Blender."""
import bpy, os, re, math
from mathutils import Vector

ROOT = r'C:\Users\hamze\Home\Desktop\Folder_1\New folder (2)'
def render():
    scene=bpy.context.scene
    previous_engine=scene.render.engine
    try:
        scene.render.engine='SKYBOUND_ENUM_LOOKUP'
    except TypeError as error:
        identifiers=re.findall(r"'([A-Z][A-Z0-9_]+)'",str(error))
        engine=next((value for value in identifiers if 'WORKBENCH' in value),previous_engine)
    scene.render.engine=engine
    print('Thumbnail engine:',engine)
    fmt=next(i.identifier for i in bpy.types.ImageFormatSettings.bl_rna.properties['file_format'].enum_items if i.identifier=='PNG')
    scene.render.image_settings.file_format=fmt
    scene.render.image_settings.color_mode=next(i.identifier for i in bpy.types.ImageFormatSettings.bl_rna.properties['color_mode'].enum_items if i.identifier=='RGBA')
    scene.render.film_transparent=True
    scene.render.resolution_x=600;scene.render.resolution_y=380;scene.render.resolution_percentage=100
    if 'WORKBENCH' in engine:
        shading=scene.display.shading
        shading.light=next(i.identifier for i in shading.bl_rna.properties['light'].enum_items if i.identifier=='STUDIO')
        shading.color_type=next(i.identifier for i in shading.bl_rna.properties['color_type'].enum_items if i.identifier=='MATERIAL')
        shading.show_shadows=True;shading.show_cavity=True;shading.show_specular_highlight=False
        shading.background_type=next(i.identifier for i in shading.bl_rna.properties['background_type'].enum_items if i.identifier=='WORLD')
    camera=scene.camera
    original_matrix=camera.matrix_world.copy();original_scale=camera.data.ortho_scale
    visibility={o:o.hide_render for o in scene.objects}
    targets=[o for o in scene.objects if o.get('skybound_category')=='aircraft']
    os.makedirs(os.path.join(ROOT,'public','thumbnails'),exist_ok=True)
    for target in targets:
        include={target,*target.children_recursive,camera}
        for o in scene.objects:o.hide_render=o not in include and o.type!='LIGHT'
        corners=[o.matrix_world@Vector(c) for o in target.children_recursive if o.type=='MESH' for c in o.bound_box]
        low=Vector(tuple(min(v[i] for v in corners) for i in range(3)))
        high=Vector(tuple(max(v[i] for v in corners) for i in range(3)))
        center=(low+high)/2;span=max(high.x-low.x,high.y-low.y)
        camera.location=center+Vector((span*.8,span,span*.75))
        camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
        camera.data.ortho_scale=span*1.35
        scene.render.filepath=os.path.join(ROOT,'public','thumbnails',target.name+'.png')
        bpy.ops.render.render(write_still=True)
    for o,hidden in visibility.items():o.hide_render=hidden
    camera.matrix_world=original_matrix;camera.data.ortho_scale=original_scale
    scene.render.resolution_x=1600;scene.render.resolution_y=1000
    scene.render.film_transparent=False
    scene.render.filepath=os.path.join(ROOT,'art','model-library.png')
    bpy.ops.render.render(write_still=True)
    scene.render.engine=previous_engine
    print('Rendered',len(targets),'aircraft thumbnails and the asset library illustration.')

render()
