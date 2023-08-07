import { ENUM_MESH_TYPE, ENUM_VIEW_TYPE } from "@/ts/Enum";
import ThreeBase from "@/ts/ThreeRender/ThreeBase";
import { ThreeOption } from "@/ts/ThreeRender/interface";
import { throttle } from "@/ts/util/util";
import * as THREE from 'three';
import { GLTF } from "three/examples/jsm/loaders/GLTFLoader";
import * as TWEEN from "@tweenjs/tween.js";
import { ON_CHANGE_VIEW, ON_SHOW_SECOND_PAGE } from "@/ts/Constants";
interface pointXY {
    x: number;
    y: number;
}

interface layerXY {
    layerX: number;
    layerY: number;
}

export default class ExhibitionModel extends ThreeBase {
    protected option: ThreeOption;
    private modelScene!: THREE.Group;
    private mixer !: THREE.AnimationMixer;
    private clock: THREE.Clock = new THREE.Clock();

    private currentView: ENUM_VIEW_TYPE = ENUM_VIEW_TYPE.internal; // 当前视图
    private initMeshPoint !: THREE.Object3D<THREE.Event>; // 初始模型点位
    private meshCeiling!: THREE.Object3D<THREE.Event>; // 天花板模型
    private mainSecondPageMeshNameList: string[] = []; //  点击物体集合
    private spriteMeshList: THREE.Object3D<THREE.Event>[] = []; // 点精灵图集合
    private spriteInitScale: pointXY = { x: 8, y: 6 }; // 点精灵初始缩放大小
    private enterArrow !: THREE.Object3D<THREE.Event>; // 进入箭头
    private onDownLayer!: layerXY;
    constructor(option: ThreeOption) {
        super(option);
        this.option = option;
    }

    private initLight() {
        const light: THREE.AmbientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(light);
        const pointLight: THREE.PointLight = new THREE.PointLight(0xffffff, 0.5);
        this.scene.add(this.camera);
        this.camera.add(pointLight);
    };

    // 初始化控制器
    private initControls() {
        this.addControls();
        this.controls.enablePan = false; // 不允许平移
        this.controls.update();
    };

    private sceneUpdate() {
        this.renderer.setAnimationLoop(() => {
            this.renderer?.render(this.scene, this.camera);
            TWEEN.update();
            if (this.mixer) {
                this.mixer.update(this.clock.getDelta());
            }
        })
    };

    // 切换到展厅内的控制器设置
    private exhibitionInsideControls(isNeedTween = true) {
        this.controls.enableZoom = false; // 是否可以缩放
        this.controls.maxPolarAngle = Math.PI * 0.7; // 最大垂直角度
        this.controls.maxDistance = Infinity; // 最大缩放距离
        this.controls.minDistance = -Infinity; // 最小缩放距离
        this.controls.enableRotate = true;
        this.spriteMeshList.map((item) => {
            item.visible = false;
            item.scale.set(this.spriteInitScale.x, this.spriteInitScale.y, 1);
        });
        this.meshCeiling.visible = true;
        this.enterArrow.visible = false;
        if (!isNeedTween) return;
        this.moveCameraTween({
            movePosition: new THREE.Vector3(-6.7, 44, 497),
            targetPosition: new THREE.Vector3(5.79, 26, 26),
            isInternal: false,
            cb: () => {
                this.handerClick(this.initMeshPoint, [ENUM_MESH_TYPE.move]);
            }
        });
    };

    // 切换到展厅外部的控制器设置
    private exhibitionOutsideControls(isNeedTween = true) {
        this.controls.enableRotate = true;
        this.controls.maxPolarAngle = Math.PI; // 最大垂直角度
        this.meshCeiling.visible = true;
        this.enterArrow.visible = true;
        this.spriteMeshList.map((item) => {
            item.visible = false;
            item.scale.set(this.spriteInitScale.x, this.spriteInitScale.y, 1);
        });
        if (!isNeedTween) return;
        this.moveCameraTween({
            movePosition: new THREE.Vector3(-315, 350, 478),
            targetPosition: new THREE.Vector3(0, 0, -1),
            isInternal: false
        });
    };

    // 切换到俯视图的控制器设置
    private exhibitionVerticalControls(isNeedTween = true) {
        this.controls.enableZoom = true;
        this.controls.enableRotate = false;
        this.controls.maxDistance = 900; // 最大缩放距离
        this.controls.minDistance = 500; // 最小缩放距离
        this.meshCeiling.visible = false;
        this.enterArrow.visible = true;
        this.spriteMeshList.map((item) => {
            item.visible = true;
            item.scale.set(85, 70, 1);
        });
        if (!isNeedTween) return;
        this.moveCameraTween({
            movePosition: new THREE.Vector3(0, 672, 0),
            targetPosition: new THREE.Vector3(0, 0, -1),
            isInternal: false
        });
    };

    //  切换不同视图
    changeView(isNeedTween = true, callback = () => { }, viewType?: ENUM_VIEW_TYPE): void {
        if (viewType) {
            this.currentView = viewType;
            callback();
        } else {
            // 展厅内
            if (this.currentView == ENUM_VIEW_TYPE.internal) {
                this.currentView = ENUM_VIEW_TYPE.vertical;
                this.exhibitionVerticalControls(isNeedTween);
                // 俯视图
            } else if (this.currentView == ENUM_VIEW_TYPE.vertical) {
                this.currentView = ENUM_VIEW_TYPE.external;
                this.exhibitionOutsideControls(isNeedTween);
            } else {
                this.currentView = ENUM_VIEW_TYPE.internal;
                this.exhibitionInsideControls(isNeedTween);
            }
        }
        this.$emit(ON_CHANGE_VIEW, this.currentView);
    };

    private onDocumentMouseDown(event: MouseEvent) {
        event.preventDefault();
        this.onDownLayer = { layerX: event.pageX, layerY: event.pageY };
    };

    // 鼠标点击事件
    private onDocumentMouseUp(event: MouseEvent) {
        event.preventDefault();
        if (Math.abs(event.pageX - this.onDownLayer.layerX) > 2 || Math.abs(event.pageY - this.onDownLayer.layerY) > 2) return;
        let { raycasterMesh } = ThreeBase.getIntersects(event.pageX, event.pageY, this.camera, this.scene);
        let firstMesh = raycasterMesh.length > 0 ? raycasterMesh[0].object : undefined; // 第一个被射线碰到的物体
        if (!firstMesh) return;
        ThreeBase.recurMeshParentName(firstMesh, [ENUM_MESH_TYPE.move, ENUM_MESH_TYPE.click, ENUM_MESH_TYPE.enter], this.handerClick);
    };

    //展示页面
    /**
     * @param {Mesh} mesh  被点击的目标
     */
    private showSecondPage(mesh: THREE.Object3D<THREE.Event>) {
        let meshName: string = mesh.userData.name.split("-")[1].split("_")[0];
        let mainSecondPageisLoading;
        // 判断是否加载过，如果加载过了，下次就不进行loading
        if (this.mainSecondPageMeshNameList.filter((item: string) => item == meshName).length >= 1) {
            mainSecondPageisLoading = false;
        } else {
            this.mainSecondPageMeshNameList.push(meshName);
            mainSecondPageisLoading = true;
        }
        this.$emit(ON_SHOW_SECOND_PAGE, {
            isShowMainSecondPage: true,
            mainSecondPageMeshName: meshName,
            mainSecondPageisLoading
        });
    };

    // 点击要移动的物体 或则要展示二级页面的物体时触发 点击事件时 @param {*} supportedTypes 支持的类型
    private handerClick = (firstMesh: THREE.Object3D<THREE.Event>, supportedTypes: string[] = []) => {
        let firstMeshUserName = firstMesh.userData.name;
        if (!firstMeshUserName) return;
        // 被点击的物体类型
        let meshType: ENUM_MESH_TYPE = firstMeshUserName.split("-")[0];
        if (!supportedTypes.includes(meshType)) return; // 如果是不支持的类型，直接return
        // 被点击后指向的物体
        let targetMeshName = firstMeshUserName.split("-")[1];
        switch (meshType) {
            case ENUM_MESH_TYPE.move:
                this.modelScene.traverse((item) => {
                    let { userData } = item;
                    if (!userData.name) return;
                    let itemMeshType = userData.name.split("-")[0]; //  当前循环mesh类型
                    if (itemMeshType != ENUM_MESH_TYPE.click) return;
                    let itemMeshName = userData.name.split("-")[1]; // 当前循环mesh名称
                    // 当前循环类型名字和要循环的名字一样时前往
                    if (itemMeshName == targetMeshName) {
                        this.changeView(
                            false,
                            () => {
                                this.exhibitionInsideControls(false);
                            },
                            ENUM_VIEW_TYPE.internal
                        );
                        this.moveCameraTween({
                            movePosition: firstMesh.position,
                            targetPosition: item.position
                        });
                    }
                });
                break;
            case ENUM_MESH_TYPE.click:
                this.showSecondPage(firstMesh);
                break;
            case ENUM_MESH_TYPE.text:
                this.showMoveText(firstMesh);
                break;
            case ENUM_MESH_TYPE.enter:
                this.exhibitionInsideControls();
                break;
            default:
                return;
        }
    };

    

    // 鼠标滑动事件时触发
    private handerMove = (firstMesh: THREE.Object3D<THREE.Event>, supportedTypes: string[] = []) => {
        let firstMeshUserName = firstMesh.userData.name;
        if (!firstMeshUserName) return;
        // 被点击的物体类型
        let meshType: ENUM_MESH_TYPE = firstMeshUserName.split("-")[0];
        if (!supportedTypes.includes(meshType)) return; // 如果是不支持的类型，直接return
        switch (meshType) {
            case ENUM_MESH_TYPE.click:
                this.showMoveText(firstMesh);
                break;
        }
    };

    // 鼠标移动到物体展示要出现的文字
    private showMoveText(mesh: THREE.Object3D<THREE.Event>) {
        if (this.currentView != ENUM_VIEW_TYPE.internal) return;
        let meshSplit = mesh.name.split("-");
        this.spriteMeshList.map((item: THREE.Object3D<THREE.Event>) => {
            let itemSplit = item.name.split("-");
            // 如果是text类型就隐藏，否则就显示
            item.visible = false;
            if (itemSplit[1] == meshSplit[1]) {
                item.visible = true;
            }
        });
    };


    private onDocumentMouseMove(event: MouseEvent) {
        event.preventDefault();
        let { raycasterMesh } = ThreeBase.getIntersects(event.pageX, event.pageY, this.camera, this.scene);
        let firstMesh: THREE.Object3D<THREE.Event> | undefined = raycasterMesh.length > 0 ? raycasterMesh[0].object : undefined; // 第一个被射线碰到的物体
        if (!firstMesh) return;
        ThreeBase.recurMeshParentName(firstMesh, [ENUM_MESH_TYPE.click], this.handerMove);
    };

    throttleOnDocumentMouseDown = throttle(this.onDocumentMouseDown.bind(this), 100);
    throttleOnDocumentMouseMove = throttle(this.onDocumentMouseMove.bind(this), 100);
    throttleOnDocumentMouseUp = throttle(this.onDocumentMouseUp.bind(this), 100);

    // 初始化
    init(loadComplete?: (gltf: GLTF) => void, loadProcess?: (xhr: ProgressEvent<EventTarget>) => void) {
        this.initScene();
        this.initWebGLRenderer();
        this.initCamera();
        this.initLight();
        this.loaderModel((gltf) => {
            this.scene.add(gltf.scene);
            this.renderer.compile(this.scene, this.camera);
            this.mixer = ThreeBase.playAllAnimate(gltf.scene, gltf.animations);
            this.modelScene = gltf.scene;
            this.modelScene.traverse((child) => {
                ThreeBase.openShowDowAndLight(child, 1);
                // 前往
                if (child.userData?.name == "move-computer") {
                    this.initMeshPoint = child;
                }
                if (child.userData?.name == "enter-arrow") {
                    this.enterArrow = child;
                    this.enterArrow.visible = false;
                }
                if (child.name == "天花板") {
                    this.meshCeiling = child;
                }
                if (child.userData.name && child.userData.name.split("-")[0] == ENUM_MESH_TYPE.finger) {
                    // 创建文字精灵物体
                    let text: string = child.userData.name.split("-")[2].split("_")[0];
                    let spriteMesh: THREE.Sprite = ThreeBase.createSpriteMesh(text);
                    spriteMesh.scale.set(this.spriteInitScale.x, this.spriteInitScale.y, 1);
                    spriteMesh.position.set(child.position.x, child.position.y + 3, child.position.z);
                    spriteMesh.name = ENUM_MESH_TYPE.text + "-" + child.userData.name.split("-")[1];
                    spriteMesh.visible = false;
                    this.spriteMeshList.push(spriteMesh);
                    this.modelScene.add(spriteMesh);
                }
            });

            // three  render cpu到gpu的渲染过程会完全阻塞浏览器
            this.renderer.render(this.scene, this.camera);
            this.camera.position.set(-556, 563, 227);
            this.controls.target = new THREE.Vector3(0, 0, -1);
            setTimeout(() => {
                this.exhibitionInsideControls();
            }, 800);

            this.sceneUpdate();
            loadComplete && loadComplete(gltf)
        }, (xhr) => {
            loadProcess && loadProcess(xhr)
        })
        this.initControls();
        window.addEventListener("resize", this.onWindowResize(this.camera, this.renderer), false);
        this.option.renderContainer.value?.addEventListener("mousemove", this.throttleOnDocumentMouseMove, false);
        this.option.renderContainer.value?.addEventListener("mousedown", this.throttleOnDocumentMouseDown, false);
        this.option.renderContainer.value?.addEventListener("mouseup", this.throttleOnDocumentMouseUp, false);
    }

    getModelScene() {
        return this.modelScene;
    }
}