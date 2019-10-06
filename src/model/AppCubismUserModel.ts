import { CubismUserModel, ICubismModelSetting } from '../index';


export default class AppCubismUserModel extends CubismUserModel {

    constructor() {
        super();
    }

    /**
     * モデルのパラメータを更新する
     */
    public update() {

        // ポーズ
        if (this._pose !== null)
            this._pose.updateParameters(this._model, 0);

        this._model.update();

    }

}