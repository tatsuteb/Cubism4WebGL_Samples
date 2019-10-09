import {
    CubismUserModel,
    ACubismMotion,
    CubismMotion,
    csmVector,
    CubismIdHandle
} from '../index';

interface MotionResources {
    [name: string]: ACubismMotion;
}

export default class AppCubismUserModel extends CubismUserModel {

    private motionResources: MotionResources;
    private lipSyncParamIds: csmVector<CubismIdHandle> = new csmVector<CubismIdHandle>();
    private eyeBlinkParamIds: csmVector<CubismIdHandle> = new csmVector<CubismIdHandle>();

    constructor() {

        super();

        this.motionResources = {};
        this.lipSyncParamIds = new csmVector<CubismIdHandle>();
        this.eyeBlinkParamIds = new csmVector<CubismIdHandle>();

        // NOTE: モーションに目ぱちと口パク用のIDのベクター型配列を渡さずに再生すると、nullで落ちるので注意
        // 目ぱちと口パク用のIDを取得
        // const eyeBlinkParamIds: csmVector<CubismIdHandle> = new csmVector<CubismIdHandle>();
        // for (let i = 0; i < modelSetting.getEyeBlinkParameterCount(); i++) {
        //     eyeBlinkParamIds.pushBack(modelSetting.getEyeBlinkParameterId(i));
        // }
        // const lipSyncParamIds: csmVector<CubismIdHandle> = new csmVector<CubismIdHandle>();
        // for (let i = 0; i < modelSetting.getLipSyncParameterCount(); i++) {
        //     lipSyncParamIds.pushBack(modelSetting.getLipSyncParameterId(i));
        // }
        
    }

    /**
     * モーションを追加して、ID（インデックス）を返す
     * @param buffer モーションデータ
     * @param name モーション名
     */
    public addMotion(buffer: ArrayBuffer, name: string, fadeIn: number = 1, fadeOut: number = 1): string {

        const motion = this.loadMotion(buffer, buffer.byteLength, name);
        
        if (fadeIn > 0) motion.setFadeInTime(fadeIn);
        if (fadeOut > 0) motion.setFadeOutTime(fadeOut);

        (motion as CubismMotion).setEffectIds(this.eyeBlinkParamIds, this.lipSyncParamIds);

        this.motionResources[name] = motion;

        return name;

    }

    /**
     * 登録されているモーションのIDと名前のリストを返す
     */
    public get motionNames(): string[] {

        return Object.keys(this.motionResources);

    }

    /**
     * モーションの再生が終わっているかどうか
     */
    public get isMotionFinished(): boolean {

        return this._motionManager.isFinished();

    }

    /**
     * モーションの名前を指定して再生する
     * @param name モーション名
     */
    public startMotionByName(name: string) {

        const motion = this.motionResources[name];

        if (!motion) return;

        this._motionManager.startMotionPriority(motion, false, 0);

    };

    /**
     * モデルのパラメータを更新する
     */
    public update(deltaTimeSecond: number) {

        this.getModel().loadParameters();
        
        // モデルのパラメータを更新
        this._motionManager.updateMotion(this.getModel(), deltaTimeSecond);

        this.getModel().saveParameters();

        // ポーズ
        if (this._pose !== null)
            this._pose.updateParameters(this._model, 0);
        
        // 物理演算
        if (this._physics != null)
            this._physics.evaluate(this._model, deltaTimeSecond);

        this._model.update();

    }

}