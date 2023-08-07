import { MoveCameraTweenParams, ThreeOption, DestroyModelParams } from "./interface"
import * as THREE from "three";
import { GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import MyDRACOLoader from "./MyDRACOLoader";
import { ItFnArr, ItPlayAllSpecialAnimateFn } from "@/ts/interface/modelRender";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import Emitter from "@/ts/util/Emitter";
import Stats from "three/examples/jsm/libs/stats.module";
import * as TWEEN from "@tweenjs/tween.js";



class ThreeBase extends Emitter {
    protected option: ThreeOption;
    protected scene!: THREE.Scene;
    protected camera!: THREE.PerspectiveCamera;
    protected renderer !: THREE.WebGLRenderer;
    protected controls!: OrbitControls;
    protected stats: Stats = new Stats();
    private globalTween!: TWEEN.Tween<THREE.Vector3>;
    private oldControlsEnableRotate!: boolean;

    constructor(option: ThreeOption) {
        super();
        this.option = option;
    }

    static isMesh(obj: unknown): obj is THREE.Mesh {
        return (typeof obj === "object" && obj !== null && "isMesh" in obj);
    }

    static isLight(obj: unknown): obj is THREE.Light {
        return obj instanceof THREE.Light;
    }

    // 获取射线交点，用于判断是否接触到物体了
    /**
     *
     * @param {Number} x 鼠标x
     * @param {Number} y 鼠标y
     * @param {Camera} camera 正在使用的相机
     * @param {Scene} scene 要被判断的场景
     * @returns
     */
    static getIntersects(x: number, y: number, camera: THREE.PerspectiveCamera, scene: THREE.Scene) {
        if (!camera || !scene) return { raycasterMesh: [] };
        let raycaster: THREE.Raycaster = new THREE.Raycaster();
        let mouse: THREE.Vector2 = new THREE.Vector2();
        x = (x / window.innerWidth) * 2 - 1;
        y = -(y / window.innerHeight) * 2 + 1;
        mouse.set(x, y);
        raycaster.setFromCamera(mouse, camera);
        let raycasterMesh = raycaster.intersectObjects(scene.children); // 穿过的物体
        return {
            raycasterMesh,
        };
    };

    // 创建精灵mesh
    static createSpriteMesh(name: string, color: number = 0xffff00, font: string = "Bold 60px Arial", lineWidth: number = 2): THREE.Sprite {
        //先用画布将文字画出
        let canvas: HTMLCanvasElement = document.createElement("canvas");
        canvas.width = 400;
        canvas.height = 200;
        let ctx: CanvasRenderingContext2D | null = canvas.getContext("2d");
        if (ctx) {
            ctx.fillStyle = "#fff";
            ctx.font = font;
            ctx.textAlign = "center";
            ctx.lineWidth = lineWidth;
            ctx.fillText(name, 200, 150);
        }
        let texture: THREE.Texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;
        //使用Sprite显示文字
        let material: THREE.SpriteMaterial = new THREE.SpriteMaterial({ map: texture, color });
        let sprite: THREE.Sprite = new THREE.Sprite(material);
        return sprite;
    };



    protected initWebGLRenderer(): void {
        //设置渲染器，并添加抗锯齿效果
        this.renderer = new THREE.WebGLRenderer(this.option.webGLRendererParameters || {
            antialias: true,
            // precision: "hiphp",
            precision: "lowp", // 解决移动端卡顿问题
            alpha: true,
        });
        this.renderer.setPixelRatio(this.option.devicePixelRatio || window.devicePixelRatio);
        this.renderer.setSize(this.option.renderWidth || window.innerWidth, this.option.renderHeight || window.innerHeight);
        this.renderer.setClearColor(this.option.renderBackgroundColor || 0x000000, this.option.renderAlpha ?? 1);
        this.renderer.outputColorSpace = this.option.renderOutputColorSpace || THREE.LinearSRGBColorSpace;
        // @ts-ignore;
        this.renderer.physicallyCorrectLights = this.option.renderPhysicallyCorrectLights || false;
        this.renderer.shadowMap.enabled = this.option.renderShadowMapEnabled || false;
        this.option.renderContainer.value?.appendChild(this.renderer.domElement);
    }

    protected initScene(): void {
        this.scene = new THREE.Scene();
    }

    protected addControls(): void {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    }

    protected initCamera(): void {
        this.camera = new THREE.PerspectiveCamera(this.option.cameraFov, (this.option.renderWidth || window.innerWidth) / (this.option.renderHeight || window.innerHeight), this.option.cameraNear, this.option.cameraFar);
        this.camera.position.copy(this.option.cameraPosition);
    }

    protected loaderModel(loadComplete: (gltf: GLTF) => void, loadProcess?: (xhr: ProgressEvent<EventTarget>) => void): void {
        const myDRACOLoader = new MyDRACOLoader();
        const loader = new GLTFLoader();
        loader.setDRACOLoader(myDRACOLoader.getDRACOLoader());
        loader.load(
            this.option.blgUrl,
            (gltf) => {
                loadComplete(gltf);
            },
            (xhr) => {
                loadProcess && loadProcess(xhr)
            },
            (error) => {
                console.log({ loadModelError: error });
            }
        );
    }

    /**
     * 执行模型中动画
     * @param mesh  执行的动画的mesh
     * @param animations 要执行的动画集合
     * @param setFramePlay  从第几帧开始播放
     * @param playAllSpecialAnimateFn  执行动画要带的参数，如要调整某个动画的时长等
     * @returns 
     */
    static playAllAnimate(mesh: THREE.Group, animations: THREE.AnimationClip[], setFramePlay: number = 1, playAllSpecialAnimateFn: ItPlayAllSpecialAnimateFn[] = []): THREE.AnimationMixer {
        let mixer: THREE.AnimationMixer  = new THREE.AnimationMixer(mesh);
        animations.forEach(function (clip): void {
            mixer.setTime(setFramePlay);
            let findItem = playAllSpecialAnimateFn.find((item) => item.animationName == clip.name);
            if (findItem) {
                let mixerStorage = mixer.clipAction(clip);
                findItem.fnArr.map((item: ItFnArr) => {
                    mixerStorage = (mixerStorage as any)[item.fn](item.fnParams);
                });
                mixerStorage.play();
            } else {
                mixer.clipAction(clip).play();
            }
        });
        return mixer;
    };

    protected initStats() {
        this.stats.showPanel(0);
        this.stats.dom.style.position = "absolute";
        this.stats.dom.style.left = "0px";
        this.stats.dom.style.top = "0px";
        document.body.appendChild(this.stats.dom);
    };


    // 页面窗口变动，重新渲染
    protected onWindowResize(camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) {
        return () => {
            let width: number = this.option.renderWidth || window.innerWidth;
            let height: number = this.option.renderHeight || window.innerHeight;
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
        };
    };

    // 显示阴影公共处理方法  isReceiveShadow 是否投射阴影
    static showShowDow(mesh: any, isReceiveShadow: boolean = false, isCastShadow: boolean = false) {
        if (isReceiveShadow || isCastShadow) {
            mesh.castShadow = true;
            mesh.material.side = THREE.DoubleSide;
            mesh.material.shadowSide = THREE.BackSide;
        }
        if (isReceiveShadow) {
            mesh.receiveShadow = true;
        }
    };

    // 显示灯光公共处理方法 isCastShadow 是否显示阴影 intensityDivided导出转换的功率的倍率
    static showLight(light: any, isCastShadow: boolean = false, intensityDivided: number = 1) {
        light.intensity = light.intensity / intensityDivided;
        light.castShadow = isCastShadow;
        if (isCastShadow) {
            light.shadow.mapSize.width = 2048;
            light.shadow.mapSize.height = 2048;
        }
    };


    // 开启模型灯光阴影
    static openShowDowAndLight(mesh: THREE.Object3D<THREE.Event>, intensityDivided?: number) {
        if (ThreeBase.isMesh(mesh)) {
            this.showShowDow(mesh, mesh.name.includes("rShadow"), mesh.name.includes("cShadow"));
        }
        if (ThreeBase.isLight(mesh)) {
            this.showLight(mesh, mesh.name.includes("cShadow"), intensityDivided);
        }
    };


    // 移动位置动画
    protected moveCameraTween(param: MoveCameraTweenParams) {
        let { movePosition, targetPosition, isInternal = true, cb = () => { }, animateTime = 3000 } = param;
        let toTargetPositionY = isInternal ? targetPosition.y : movePosition.y;
        if (this.globalTween) {
            this.globalTween.stop();
        }
        // 解决微任务bug
        setTimeout(() => {
            this.oldControlsEnableRotate = this.controls.enableRotate;
            this.controls.enableRotate = false;
        }, 0);
        this.globalTween = new TWEEN.Tween(this.camera.position)
            .to(new THREE.Vector3(movePosition.x, toTargetPositionY, movePosition.z), animateTime)
            .easing(TWEEN.Easing.Sinusoidal.InOut)
            .start()
            .onUpdate((nowPosition, percentage) => {
                this.controls.target.set(
                    targetPosition.x * percentage + nowPosition.x * (1 - percentage),
                    targetPosition.y * percentage + nowPosition.y * (1 - percentage),
                    targetPosition.z * percentage + nowPosition.z * (1 - percentage)
                );
                this.controls.update();
            })
            .onComplete(() => {
                this.controls.enableRotate = this.oldControlsEnableRotate;
                // 看向物体前方一点
                if (isInternal) {
                    let firstMeshPositionCopy: THREE.Vector3 = movePosition.clone();
                    let targetMeshPositionCopy: THREE.Vector3 = targetPosition.clone();
                    firstMeshPositionCopy.lerp(targetMeshPositionCopy, 0.05);
                    this.controls.target.set(firstMeshPositionCopy.x, targetMeshPositionCopy.y, firstMeshPositionCopy.z);
                }
                cb();
            });
    };

    // 循环递归具有某个标识符的父级模型
    /**
     *
     * @param {THREE.Object3D<THREE.Event>} mesh
     * @param {Array} supportedTypes 支持的类型
     * @param {(firstMesh: THREE.Object3D<THREE.Event>, supportedTypes: string[]) => void} handerClick 回调后要被执行的函数
     * @param {Fucntion} identifier 回调后要被执行的函数
     */
    static recurMeshParentName(
        mesh: THREE.Object3D<THREE.Event>,
        supportedTypes: string[] = [],
        fn: (firstMesh: THREE.Object3D<THREE.Event>, supportedTypes: string[]) => void,
        identifier: string = '-'
    ): void | boolean {
        if (mesh.userData.name && mesh.userData.name.split(identifier).length > 1) {
            fn(mesh, supportedTypes);
        } else if (mesh.parent == null) {
            return false;
        } else {
            this.recurMeshParentName(mesh.parent, supportedTypes, fn);
        }
    };




    // 销毁模型
    protected destroyModel<K extends keyof HTMLElementEventMap>(destroyModelParams: DestroyModelParams<K>) {
        let { modelScene, throttleOnDocumentMouseMove, type } = destroyModelParams;
        window.removeEventListener("resize", this.onWindowResize(this.camera, this.renderer), false);
        if (throttleOnDocumentMouseMove && type) {
            this.option.renderContainer.value?.removeEventListener(type, throttleOnDocumentMouseMove, false);
        }
        modelScene.traverse((child: any) => {
            if (child.isMesh) {
                child.geometry.dispose();
                child.material.dispose();
            }
            child = null;
        });
        this.scene.remove(modelScene);
        this.scene.clear();
        this.renderer.forceContextLoss();
        this.renderer.dispose();
        this.renderer.clear();
        this.renderer = null!;
        this.scene = null!;
        THREE.Cache.clear();
    }

    getScene() {
        return this.scene;
    }

    getCamera() {
        return this.camera;
    }

    getRenderer() {
        return this.renderer;
    }


}

export default ThreeBase