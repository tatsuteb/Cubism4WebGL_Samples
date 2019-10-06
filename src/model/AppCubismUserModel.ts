import { CubismUserModel, ICubismModelSetting } from '../index';


export default class AppCubismUserModel extends CubismUserModel {

    constructor() {
        super();
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