<template>
  <div class="page">
    <!-- @click="getCamera" -->
    <div ref="container"></div>
    <Loading :progress="progress" :isShowLoadingIcon="isShowLoadingIcon" v-if="isLoading" @complete="complete" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, defineProps, onBeforeUnmount, getCurrentInstance, Ref } from "vue";
import * as THREE from "three";
import Loading from "@/components/Loading/Loading.vue";
import carGlbUrl from "@/assets/models/car.glb";
import { isMobile } from "@/ts/util/util";
import { ItControlsObject, ItPlayAllSpecialAnimateFn } from "@/ts/interface/modelRender";
import { XYZ } from "@/ts/interface/commonInterface";
import * as CommonInterface from "@/ts/interface/commonInterface";
import CommonModel from "./CommonModel";
import { ON_MODEL_PROGRESS } from "@/ts/Constants";

interface ItCommonRenderItemData {
  camraPosition?: XYZ; // 相机的位置
  glbUrl?: string; // 要加载glb路径
  controlsObject?: ItControlsObject; // 控制器的限制范围
  isNeedAmbientLight?: boolean; // 是否需要环境光
  ambientLightColor?: number; // 环境灯光颜色
  ambientIntensity?: number; // 环境光强度
  isNeedCameraPointLight?: boolean; // 是否需要相机上的点光源
  cameraPointLightColor?: number; // 相机上的点光源颜色
  cameraPointLightIntensity?: number; // 相机上的点光源强度
  intensityDivided?: number; // 功率要除以的倍数
  isSelfRotation?: boolean; // 模型是否自转
  renderOutputColorSpace?: THREE.ColorSpace; // render颜色类型
  playAllSpecialAnimateFn?: ItPlayAllSpecialAnimateFn[]; // 动画执行Fn    // AnimationAction 中的方法 // [{animationName:'', fnArr: [{fn:'', fnParams:''}]}]
}

const props = withDefaults(defineProps<ItCommonRenderItemData>(), {
  camraPosition: () => {
    return {
      x: 0,
      y: 0,
      z: 0,
    };
  },
  glbUrl: carGlbUrl,
  controlsObject: () => {
    return {};
  },
  isNeedAmbientLight: false,
  ambientLightColor: 0xffffff,
  ambientIntensity: 1,
  isNeedCameraPointLight: false,
  cameraPointLightColor: 0xffffff,
  cameraPointLightIntensity: 0.8,
  intensityDivided: 1,
  isSelfRotation: false,
  renderOutputColorSpace: THREE.LinearSRGBColorSpace,
  playAllSpecialAnimateFn: () => [],
});

let container: Ref<HTMLElement | null> = ref(null);
let isShowLoadingIcon = ref(false);

let commonModel = new CommonModel(
  {
    renderAlpha: 0,
    renderOutputColorSpace: props.renderOutputColorSpace,
    renderPhysicallyCorrectLights: true,
    renderShadowMapEnabled: true,
    renderContainer: container,
    cameraFov: isMobile() ? 110 : 90,
    cameraNear: 0.1,
    cameraFar: 100,
    cameraPosition: new THREE.Vector3(props.camraPosition.x, props.camraPosition.y, props.camraPosition.z),
    blgUrl: props.glbUrl,
  },
  props
);

let getCamera = () => {
  console.log({ camera: commonModel.getCamera() });
};
let progress: Ref<number> = ref(0);
let isLoading:Ref<boolean> = ref(true);

// 加载进度条
// type ProgessParams = [nowProgress: number];
// commonModel.$on(ON_MODEL_PROGRESS, ([nowProgress]: ProgessParams) => {
//   progress.value = nowProgress;
// });

let complete = () => {
  commonModel.init(() => {
    isLoading.value = false;
  },(xhr) => {
    let nowProgress: number = Math.floor((xhr.loaded / xhr.total) * 100);
    progress.value = nowProgress;
    isShowLoadingIcon.value = nowProgress === 100;
  });
};

onMounted(() => {
  
});

onBeforeUnmount(() => {
  try {
    commonModel.destroyModel({
      modelScene: commonModel.getModelScene(),
      type: "mousemove",
      throttleOnDocumentMouseMove: commonModel.getThrottleOnDocumentMouseMove(),
    });
  } catch (e) {
    console.log(e);
  }
});
</script>
<style scoped lang="less">
.page {
  width: 100%;
  height: 100%;
  background: url("../../assets/images/bg.jpg") no-repeat center center / 100% 100%;
  background-size: auto 100%;
  background-position: right bottom;
  z-index: 5;
}

.loadingIcon {
  width: 100vw;
  height: 100vh;
  position: fixed;
  left: 0;
  top: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    width: 100px;
    height: 100px;
    animation: loading 1s linear infinite;
  }
  @keyframes loading {
    0% {
      transform: rotate(0);
    }
    100% {
      transform: rotate(360deg);
    }
  }
}
</style>
@/ts/interface11/modelRender@/ts/interface11/commonInterface
