# Assets

`foot_template_left.png` and `foot_template_right.png` are the fixed PNG
templates used directly by the pressure-map canvas. No SVG template is
currently present in the project. The templates are derived from separate
user-provided left/right foot images; the canvas does not mirror either side.

`foot_mask_left.png` and `foot_mask_right.png` are alpha masks derived from the
matching template images and are used only to clip the transparent heatmap
overlay inside each footprint shape.
