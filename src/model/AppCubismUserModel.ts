import { CubismUserModel } from '../../l2dsdk/Framework/src/model/cubismusermodel';

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