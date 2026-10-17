import Phaser from "phaser";

const FRAG_SHADER = `
#define SHADER_NAME LIVING_WORLD_FS
precision mediump float;

uniform sampler2D uMainSampler;
uniform sampler2D uMaterialSampler;
uniform float uTime;
uniform vec2 uResolution;
uniform float uReducedMotion;

varying vec2 outTexCoord;

void main ()
{
    vec2 uv = outTexCoord;
    vec4 baseColor = texture2D(uMainSampler, uv);
    if (baseColor.a < 0.01) {
        gl_FragColor = vec4(0.0);
        return;
    }

    if (uReducedMotion > 0.5) {
        gl_FragColor = baseColor;
        return;
    }

    vec4 mat = texture2D(uMaterialSampler, uv);
    vec3 mRgb = mat.rgb;

    vec2 disp = vec2(0.0);
    vec3 colorMod = vec3(1.0);

    // 1. Water (B dominant: b > 0.65, r < 0.35, g < 0.35)
    if (mRgb.b > 0.65 && mRgb.r < 0.35 && mRgb.g < 0.35) {
        float flowY = sin(uv.y * 65.0 - uTime * 6.0);
        float rippleX = sin(uv.y * 50.0 + uTime * 4.5) * 1.5;
        float rippleY = cos(uv.x * 60.0 + uTime * 3.5) * 1.2;
        disp = vec2(rippleX, rippleY) / uResolution;

        // Crest shimmer highlights
        float crest = max(0.0, sin(uv.y * 85.0 - uTime * 7.5 + uv.x * 35.0));
        colorMod += vec3(0.08, 0.16, 0.26) * pow(crest, 4.0);
    }
    // 2. Canopy (Dark green: g between 0.15 and 0.55, r < 0.25, b < 0.25)
    else if (mRgb.g > 0.15 && mRgb.g < 0.55 && mRgb.r < 0.25 && mRgb.b < 0.25) {
        float gust = sin(uTime * 0.8) * sin(uTime * 1.7);
        gust = clamp(gust * 1.5, 0.0, 1.0);
        float sway = (sin(uTime * 2.2 + uv.x * 30.0) * 0.4 + sin(uTime * 3.8 + uv.x * 50.0) * 0.6 * gust);
        disp.x = sway * (1.0 / uResolution.x); // 0 to 1 px sway
    }
    // 3. Cloth (Yellow: r > 0.7, g > 0.7, b < 0.3)
    else if (mRgb.r > 0.7 && mRgb.g > 0.7 && mRgb.b < 0.3) {
        float flutter = sin(uTime * 10.0 + uv.x * 80.0 + uv.y * 40.0);
        disp.x = flutter * (0.8 / uResolution.x);
        disp.y = cos(uTime * 8.0 + uv.y * 60.0) * (0.4 / uResolution.y);
    }
    // 4. Fire (r > 0.7, g < 0.3, b between 0.2 and 0.8)
    else if (mRgb.r > 0.7 && mRgb.g < 0.3 && mRgb.b > 0.2 && mRgb.b < 0.8) {
        float jx = sin(uTime * 28.0);
        float jy = cos(uTime * 34.0);
        disp = vec2(jx, jy) * (0.8 / uResolution);

        float flicker = 1.0 + 0.22 * sin(uTime * 16.0) * sin(uTime * 25.0 + uv.x * 30.0);
        colorMod = vec3(flicker * 1.15, flicker * 0.95, flicker * 0.8);
    }

    vec4 displacedColor = texture2D(uMainSampler, uv + disp);
    if (displacedColor.a > 0.05) {
        gl_FragColor = vec4(displacedColor.rgb * colorMod, displacedColor.a);
    } else {
        gl_FragColor = vec4(baseColor.rgb * colorMod, baseColor.a);
    }
}
`;

export class LivingWorldPipeline
  extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline
{
  public static readonly PIPELINE_NAME = "LivingWorldPipeline";
  private timeVal = 0;
  private materialKey = "dev-island-material";
  private isReducedMotion = false;

  constructor(game: Phaser.Game) {
    super({
      game,
      name: LivingWorldPipeline.PIPELINE_NAME,
      fragShader: FRAG_SHADER,
    });
  }

  public setMaterialTextureKey(key: string): void {
    this.materialKey = key;
  }

  public setReducedMotion(reduced: boolean): void {
    this.isReducedMotion = reduced;
  }

  public setShaderTime(timeSeconds: number): void {
    this.timeVal = timeSeconds;
  }

  public override onDraw(source: Phaser.Renderer.WebGL.RenderTarget): void {
    const target = this.fullFrame1;
    const phaserTexture = this.game.textures.getFrame(this.materialKey);

    if (
      !phaserTexture ||
      !phaserTexture.glTexture ||
      this.isReducedMotion ||
      !target
    ) {
      this.copyFrame(source, target);
      this.copyToGame(target ?? source);
      return;
    }

    this.bind();
    this.set1i("uMainSampler", 0);
    this.set1i("uMaterialSampler", 1);
    this.set1f("uTime", this.timeVal);
    this.set2f("uResolution", source.width, source.height);
    this.set1f("uReducedMotion", this.isReducedMotion ? 1.0 : 0.0);

    this.bindTexture(phaserTexture.glTexture, 1);
    this.copySprite(source, target);
    this.copyToGame(target);
  }

  public static register(game: Phaser.Game): boolean {
    const renderer = game.renderer;
    if (renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) {
      const pipelines = renderer.pipelines;
      if (!pipelines.has(LivingWorldPipeline.PIPELINE_NAME)) {
        pipelines.addPostPipeline(
          LivingWorldPipeline.PIPELINE_NAME,
          LivingWorldPipeline
        );
      }
      return true;
    }
    return false;
  }
}
