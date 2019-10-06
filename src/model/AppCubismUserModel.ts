import { CubismUserModel, ACubismMotion } from '../index';

interface MotionInfo {
    id: number;
    name: string;

}

export default class AppCubismUserModel extends CubismUserModel {

    private static nextMotionId = 0;

    private motions: ACubismMotion[];
    private _motionInfoList: MotionInfo[];

    constructor() {
        super();

        this.motions = [];
        this._motionInfoList = [];

    }

    /**
     * モーションを追加して、ID（インデックス）を返す
     * @param buffer モーションデータ
     * @param name モーション名
     */
    public addMotion(buffer: ArrayBuffer, name: string, fadeIn: number = 1, fadeOut: number = 1): number {

        const motion = this.loadMotion(buffer, buffer.byteLength, name);
        
        if (fadeIn > 0) motion.setFadeInTime(fadeIn);
        if (fadeOut > 0) motion.setFadeOutTime(fadeOut);

        const motionInfo = {
            id: AppCubismUserModel.nextMotionId++,
            name
        } as MotionInfo;

        this.motions.push(motion);
        this._motionInfoList.push(motionInfo);

        return motionInfo.id;

    }

    /**
     * 登録されているモーションのIDと名前のリストを返す
     */
    public get motionInfoList(): MotionInfo[] {

        return this.motionInfoList;

    }

    /**
     * モデルのパラメータを更新する
     */
    public update(deltaTimeSecond: number) {

        // ポーズ
        if (this._pose !== null)
            this._pose.updateParameters(this._model, 0);
        
        if (this._physics != null)
            this._physics.evaluate(this._model, deltaTimeSecond);

        this._model.update();

    }

}