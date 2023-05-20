
import * as Parser from './Parser';
import * as Exec from './Exec';

function main() {
    const mod = Parser.parse(`
//Shader implementation of Troy Sobotka's AgX, translated to shader originally by Olivier Groulx
//https://github.com/sobotka/AgX
//https://github.com/sobotka/SB2383-Configuration-Generation
//https://github.com/sobotka/SuazoBrejon2383-Configuration
//https://github.com/macrofacet/horoma

// #define SHOW_ACES 0 //sometimes you just need to see why we don't use ACES

//AgX Settings
const float MIDDLE_GREY = 0.18f;
const float SLOPE = 2.3f;
const float TOE_POWER = 1.9f;
const float SHOULDER_POWER = 3.1f;
const float COMPRESSION = 0.15;

//"Look" Settings
//Try 1.2 for a more saturated look. There's nothing wrong with intentionally skewing to develop a look you like,
//because intention is the entire point. That's why we should separate grading from compression, rather
//than combining them and forcing an artist 
const float SATURATION = 1.0; 

//Demo Settings
const float EXPOSURE = 0.0;
const float MIN_EV = -10.0f;
const float MAX_EV = 6.5f;
const float AGX_LERP = 1.0;

void main() {
    print(float3(1.0, 2.0, 3.0).xyyx);
}

    `);

    const exec = new Exec.Exec(mod);
    exec.evalFunction('main');
}

main();
