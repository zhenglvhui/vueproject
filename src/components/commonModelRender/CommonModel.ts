import ThreeBase from "@/ts/ThreeRender/ThreeBase";
import { ThreeOption } from "@/ts/ThreeRender/interface";
import { ItCommonRenderItemData } from "@/ts/interface/modelRender";
import { throttle } from "@/ts/util/util";
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { GLTF } from "three/examples/jsm/loaders/GLTFLoader";
import { Ref, ref } from "vue";

export default class CommonModel extends ThreeBase {
    protected option: ThreeOption;
    private modelScene!: THREE.Group;
    private mixer !: THREE.AnimationMixer;
    private clock: THREE.Clock = new THREE.Clock();
    private props: ItCommonRenderItemData;
    private isMouseAtMesh: Ref<Boolean> = ref(false);
    constructor(option: ThreeOption, props: ItCommonRenderItemData) {
        super(option);
        this.option = option;
        this.props = props
    }

    private initLight() {
        let { isNeedAmbientLight, ambientLightColor, ambientIntensity, isNeedCameraPointLight, cameraPointLightColor, cameraPointLightIntensity } = this.props;
        if (isNeedAmbientLight) {
            const light: THREE.AmbientLight = new THREE.AmbientLight(ambientLightColor, ambientIntensity);
            this.scene.add(light);
        }
        if (isNeedCameraPointLight) {
            const pointLight: THREE.PointLight = new THREE.PointLight(cameraPointLightColor, cameraPointLightIntensity);
            this.scene?.add(this.camera);
            this.camera.add(pointLight);
        }
    };

    // 初始化控制器
    private initControls() {
        this.addControls();
        for (const key in this.props.controlsObject) {
            (this.controls as any)[key] = (this.props.controlsObject as any)[key];
        }
        this.controls.update();
    };


    private sceneUpdate() {
        this.renderer.setAnimationLoop(() => {
            this.selfRotation();
            this.renderer?.render(this.scene, this.camera);
            if (this.mixer) {
                this.mixer.update(this.clock.getDelta());
            }
        })
    };

    private selfRotation() {
        let { isSelfRotation } = this.props;
        if (!isSelfRotation || !this.modelScene || !this.isMouseAtMesh.value) return;
        this.modelScene.rotateY(0.001);
    };

    private onDocumentMouseMove(event: MouseEvent) {
        event.preventDefault();
        let { raycasterMesh } = ThreeBase.getIntersects(event.pageX, event.pageY, this.camera, this.scene);
        this.isMouseAtMesh.value = !raycasterMesh.length;
    };

    throttleOnDocumentMouseMove = throttle(this.onDocumentMouseMove.bind(this), 100);

    // 初始化
    init(loadComplete?: (gltf: GLTF) => void, loadProcess?: (xhr: ProgressEvent<EventTarget>) => void) {
        this.initScene();
        this.initWebGLRenderer();
        this.initCamera();
        this.initLight();
        this.loaderModel((gltf) => {
            this.scene.add(gltf.scene);
            this.modelScene = gltf.scene;
            this.mixer = ThreeBase.playAllAnimate(gltf.scene, gltf.animations, 1, this.props.playAllSpecialAnimateFn);
            this.modelScene.traverse((child) => {
                ThreeBase.openShowDowAndLight(child, this.props.intensityDivided);
            });
            this.renderer?.render(this.scene, this.camera);
            this.sceneUpdate();
            loadComplete && loadComplete(gltf)
        }, (xhr) => {
            loadProcess && loadProcess(xhr)
        })
        this.initControls();
        window.addEventListener("resize", this.onWindowResize(this.camera, this.renderer), false);
        this.option.renderContainer.value?.addEventListener("mousemove", this.throttleOnDocumentMouseMove, false);
    }

    getModelScene() {
        return this.modelScene;
    }
   
}