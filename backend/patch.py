import os
path = r"C:\Users\Zaheer\OneDrive\Desktop\attendance tracking\backend\venv\Lib\site-packages\face_recognition_models\__init__.py"
new_content = """# -*- coding: utf-8 -*-
__author__ = "Adam Geitgey"
__email__ = "ageitgey@gmail.com"
__version__ = "0.1.0"
import os as _os
_dir = _os.path.dirname(_os.path.abspath(__file__))
def pose_predictor_model_location():
    return _os.path.join(_dir, "models/shape_predictor_68_face_landmarks.dat")
def pose_predictor_five_point_model_location():
    return _os.path.join(_dir, "models/shape_predictor_5_face_landmarks.dat")
def face_recognition_model_location():
    return _os.path.join(_dir, "models/dlib_face_recognition_resnet_model_v1.dat")
def cnn_face_detector_model_location():
    return _os.path.join(_dir, "models/mmod_human_face_detector.dat")
"""
open(path, "w").write(new_content)
print("Patched!")
