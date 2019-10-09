import {
    CubismFramework,
    ICubismModelSetting,
    CubismModelSettingJson,
    CubismMatrix44,
    CubismMotionManager,
    CubismEyeBlink
} from './index';
import AppCubismUserModel from './model/AppCubismUserModel';


document.addEventListener('DOMContentLoaded', async () => {

    const resourcesDir = './Resources/Hiyori/';
    const model3JsonFilename = 'Hiyori.model3.json';

    /**
     * Canvasの初期化
     */

    const canvas = document.getElementById('canvas') as HTMLCanvasElement;

    /**
     * WebGLコンテキストの初期化
     */

    const gl = canvas.getContext('webgl');

    if (gl === null) return alert("WebGL未対応のブラウザです。");

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    // フレームバッファを用意
    const frameBuffer: WebGLFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);

    /**
     * Frameworkの初期化
     */

    CubismFramework.startUp();
    CubismFramework.initialize();

    /**
     * .model3.jsonファイルを読み込む
     */

    const model3JsonArrayBuffer = await loadAsArrayBufferAsync(`${resourcesDir}${model3JsonFilename}`)
        .catch(error => {
            console.log(error);
            return null;
        }) as ArrayBuffer;

    if (model3JsonArrayBuffer === null) return;

    /**
     * ModelSettingオブジェクトを作成
     */

    const modelSetting = new CubismModelSettingJson(model3JsonArrayBuffer, model3JsonArrayBuffer.byteLength) as ICubismModelSetting;

    /**
     * Live2Dモデルの表示に必要なファイルのパスを設定から取得する
     */

    // .moc3
    const moc3FilePath = `${resourcesDir}${modelSetting.getModelFileName()}`;

    // テクスチャ
    const textureFilePathes = [];
    const textureCount = modelSetting.getTextureCount();
    for (let i = 0; i < textureCount; i++) {
        const textureFilePath = `${resourcesDir}${modelSetting.getTextureFileName(i)}`;
        textureFilePathes.push(textureFilePath);
    }
    if (textureFilePathes.length === 0) return;

    /**
     * そのほかのファイルのパスを設定から取得する
     */

    // .pose3.json
    const pose3FilePath = `${resourcesDir}${modelSetting.getPoseFileName()}`;

    // .motion3.json
    const motionMetaDataArr: {
        path: string;
        fadeIn: number;
        fadeOut: number;
    }[] = [];
    for(let i = 0; i < modelSetting.getMotionGroupCount(); i++) {

        const groupName = modelSetting.getMotionGroupName(i);
        
        for(let j = 0; j < modelSetting.getMotionCount(groupName); j++) {
        
            const filename = modelSetting.getMotionFileName(groupName, j);
            motionMetaDataArr.push({
                path: `${resourcesDir}${filename}`,
                fadeIn: modelSetting.getMotionFadeInTimeValue(groupName, j),
                fadeOut: modelSetting.getMotionFadeOutTimeValue(groupName, j)
            });
        
        }

    }

    // .physics3.json
    const physics3FilePath = `${resourcesDir}${modelSetting.getPhysicsFileName()}`;


    /**
     * ファイル、テクスチャをまとめてロード
     */
    const [
        moc3ArrayBuffer, 
        textures, 
        pose3ArrayBuffer,
        motionArrayBuffers,
        physics3ArrayBuffer
    ] = await Promise.all([
        loadAsArrayBufferAsync(moc3FilePath),   // モデルファイル
        Promise.all(textureFilePathes.map(path => createTexture(path, gl))),    // テクスチャ
        loadAsArrayBufferAsync(pose3FilePath),   // ポーズファイル
        Promise.all(motionMetaDataArr.map(meta => loadAsArrayBufferAsync(meta.path))), // モーションファイル
        loadAsArrayBufferAsync(physics3FilePath),   // 物理演算ファイル
    ]);

    if (moc3ArrayBuffer === null) return;
    
    /**
     * Live2Dモデルの作成と設定
     */

    const model = new AppCubismUserModel();
    // モデルデータをロード
    model.loadModel(moc3ArrayBuffer);
    // ポーズデータをロード
    if (pose3ArrayBuffer !== null)
        model.loadPose(pose3ArrayBuffer, pose3ArrayBuffer.byteLength);

    // レンダラの作成（bindTextureより先にやっておく）
    model.createRenderer();
    // テクスチャをレンダラに設定
    textures.forEach((texture: WebGLTexture, index: number) => {
        model.getRenderer()
            .bindTexture(index, texture);
    });
    // そのほかレンダラの設定
    model.getRenderer().setIsPremultipliedAlpha(true);
    model.getRenderer().startUp(gl);

    // 自動目ぱち設定
    model.setEyeBlink(CubismEyeBlink.create(modelSetting));
    
    // モーションに適用する目ぱち用IDを設定
    for (let i = 0; i < modelSetting.getEyeBlinkParameterCount(); i++) {

        model.addEyeBlinkParameterId(modelSetting.getEyeBlinkParameterId(i));

    }
    // モーションに適用する口パク用IDを設定
    for (let i = 0; i < modelSetting.getLipSyncParameterCount(); i++) {

        model.addLipSyncParameterId(modelSetting.getLipSyncParameterId(i));

    }
    // モーションを登録
    motionArrayBuffers.forEach((buffer: ArrayBuffer, idx: number) => {
        
        model.addMotion(
            buffer,
            motionMetaDataArr[idx].path,
            motionMetaDataArr[idx].fadeIn,
            motionMetaDataArr[idx].fadeOut
        );

    });

    // 物理演算設定
    model.loadPhysics(physics3ArrayBuffer, physics3ArrayBuffer.byteLength);


    /**
     * Live2Dモデルのサイズ調整
     */

    const projectionMatrix = new CubismMatrix44();
    const resizeModel = () => {

        // NOTE: HTMLキャンバスのclientWidth、clientHeightが変わってもwidthとheightは変わらないので、自分で更新する
        // NOTE: スマートフォン向けにdevicePixelRatioを考慮しないとモデルがぼやける
        canvas.width = canvas.clientWidth * devicePixelRatio;
        canvas.height = canvas.clientHeight * devicePixelRatio;

        // NOTE: modelMatrixは、モデルのユニット単位での幅と高さが1×1に収まるように縮めようとしている？
        const modelMatrix = model.getModelMatrix();
        projectionMatrix.loadIdentity();
        const scale = 2;
        // NOTE:
        // 1×1にしたモデルを、キャンバスの縦横比になるように引き延ばそうとする
        // 高さを調整してモデルを正しく表示するには、高さを canvas.width/canvas.height 倍する
        // 幅を調整してモデルを正しく表示するには、幅を canvas.height / canvas.width 倍する
        const canvasRatio = canvas.height / canvas.width;
        if (1 < canvasRatio) {
            // モデルが横にはみ出る時は、HTMLキャンバスの幅で合わせる
            projectionMatrix.scale(1, canvas.width / canvas.height);
        } else {
            // モデルが上にはみ出る時は、HTMLキャンバスの高さで合わせる（スマホのランドスケープモードとか）
            projectionMatrix.scale(canvas.height / canvas.width, 1);
        }

        // モデルが良い感じの大きさになるように拡大・縮小
        projectionMatrix.scaleRelative(scale, scale);
    
        projectionMatrix.multiplyByMatrix(modelMatrix);
        model.getRenderer().setMvpMatrix(projectionMatrix);

    };
    resizeModel();
    
    /**
     * Live2Dモデルの描画
     */
    
    // フレームバッファとビューポートを、フレームワーク設定
    const viewport: number[] = [
        0,
        0,
        canvas.width,
        canvas.height
    ];

    // 最後の更新時間
    let lastUpdateTime = 0;
    const loop = (time: number) => {
        // 最後の更新からの経過時間を秒で求める
        const deltaTimeSecond = (time - lastUpdateTime) / 1000;

        // 頂点の更新
        model.update(deltaTimeSecond);
        
        if (model.isMotionFinished) {
            
            const idx = Math.floor(Math.random() * model.motionNames.length);
            const name = model.motionNames[idx];
            model.startMotionByName(name);

            setMotioinName(name);

        }

        viewport[2] = canvas.width;
        viewport[3] = canvas.height;
        model.getRenderer().setRenderState(frameBuffer, viewport);
    
        // モデルの描画
        model.getRenderer().drawModel();

        lastUpdateTime = time;
        requestAnimationFrame(loop);

    };
    requestAnimationFrame(loop);

    
    window.onresize = () => {

        resizeModel();

    };

});

/**
 * ファイルをArrayBufferとしてロードする
 * @param path ファイルのパス
 */
async function loadAsArrayBufferAsync(path: string): Promise<ArrayBuffer> {

    const response = await fetch(path)
        .catch((error) => {
            throw new Error(`Network error: ${error}`);
        });

    if (!response.ok) {
        throw new Error(`Failed to get "${path}".`);
    }

    const buffer = await response.arrayBuffer()
        .catch(() => {
            throw new Error(`Failed to load "${path}" as ArrayBuffer.`);
        });

    return buffer;

}

/**
 * テクスチャを生成する
 * @param path テクスチャのパス
 * @param gl WebGLコンテキスト
 */
async function createTexture(path: string, gl: WebGLRenderingContext): Promise<WebGLTexture> {

    return new Promise((resolve: (texture: WebGLTexture) => void, reject: (e: string) => void) => {

        // データのオンロードをトリガーにする
        const img: HTMLImageElement = new Image();
        img.onload = () => {

            // テクスチャオブジェクトの作成
            const tex: WebGLTexture = gl.createTexture();

            // テクスチャを選択
            gl.bindTexture(gl.TEXTURE_2D, tex);

            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

            // 乗算済みアルファ方式を使用する
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);

            // テクスチャにピクセルを書き込む
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

            // ミップマップを生成
            gl.generateMipmap(gl.TEXTURE_2D);

            return resolve(tex);

        };

        img.onerror = error => console.log(`${error}`);

        img.src = path;

    });

}

/**
 * 再生中のモーション名を表示する
 * @param name モーションの名前
 */
function setMotioinName(name: string) {

    const motionNameElement = document.getElementById('motionName');

    motionNameElement.innerText = name;

}