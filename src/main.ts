import {
    CubismFramework,
    ICubismModelSetting,
    CubismModelSettingJson,
    CubismMatrix44
} from './index';
import AppCubismUserModel from './model/AppCubismUserModel';


document.addEventListener('DOMContentLoaded', async () => {

    const resourcesDir = './Resources/Haru/';

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

    const model3JsonArrayBuffer = await loadAsArrayBufferAsync(`${resourcesDir}Haru.model3.json`)
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

    /**
     * ファイル、テクスチャをまとめてロード
     */
    const [
        moc3ArrayBuffer, 
        textures, 
        pose3ArrayBuffer
    ] = await Promise.all([
        loadAsArrayBufferAsync(moc3FilePath),   // モデルファイル
        Promise.all(textureFilePathes.map(path => createTexture(path, gl))),    // テクスチャ
        loadAsArrayBufferAsync(pose3FilePath)   // ポーズファイル
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
    model.getRenderer().setIsPremultipliedAlpha(false);
    model.getRenderer().startUp(gl);


    /**
     * Live2Dモデルのサイズ調整
     */

    const projectionMatrix = new CubismMatrix44();
    const modelRatio = model.getModel().getCanvasHeight() / model.getModel().getCanvasWidth();
    const resizeModel = () => {

        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;

        // NOTE: modelMatrixは、モデルのユニット単位での幅と高さが1×1に収まるように縮めようとしている？
        const modelMatrix = model.getModelMatrix();
        projectionMatrix.loadIdentity();
        const scale = 2;
        // NOTE:
        // 1×1にしたモデルを、キャンバスの縦横比になるように引き延ばそうとする
        // 高さを調整してモデルを正しく表示するには、高さを canvas.width/canvas.height 倍する
        // 幅を調整してモデルを正しく表示するには、幅を canvas.height / canvas.width 倍する
        const canvasRatio = canvas.height / canvas.width;
        if (modelRatio < canvasRatio) {
            // モデルが横にはみ出る時は、HTMLキャンバスの幅で合わせる
            projectionMatrix.scale(1, canvas.width / canvas.height);
        } else {
            // モデルが上にはみ出る時は、HTMLキャンバスの高さで合わせる
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

    const loop = (time: number) => {

        // 頂点の更新
        model.update();
    
        // フレームバッファとビューポートを、フレームワーク設定
        const viewport: number[] = [
            0,
            0,
            canvas.width,
            canvas.height
        ];
        model.getRenderer().setRenderState(frameBuffer, viewport);
    
        // モデルの描画
        model.getRenderer().drawModel();

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