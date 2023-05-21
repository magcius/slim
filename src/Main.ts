
import * as Parser from './Parser';
import * as Exec from './Exec';

function main() {
    let mod;
    
    mod = Parser.parse(`
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


mat3 InverseMat(mat3 m) 
{
    float d = m[0].x * (m[1].y * m[2].z - m[2].y * m[1].z) -
              m[0].y * (m[1].x * m[2].z - m[1].z * m[2].x) +
              m[0].z * (m[1].x * m[2].y - m[1].y * m[2].x);
              
    float id = 1.0f / d;
    
    mat3 c = mat3(1,0,0,0,1,0,0,0,1);
    
    c[0].x = id * (m[1].y * m[2].z - m[2].y * m[1].z);
    c[0].y = id * (m[0].z * m[2].y - m[0].y * m[2].z);
    c[0].z = id * (m[0].y * m[1].z - m[0].z * m[1].y);
    c[1].x = id * (m[1].z * m[2].x - m[1].x * m[2].z);
    c[1].y = id * (m[0].x * m[2].z - m[0].z * m[2].x);
    c[1].z = id * (m[1].x * m[0].z - m[0].x * m[1].z);
    c[2].x = id * (m[1].x * m[2].y - m[2].x * m[1].y);
    c[2].y = id * (m[2].x * m[0].y - m[0].x * m[2].y);
    c[2].z = id * (m[0].x * m[1].y - m[1].x * m[0].y);
    
    return c;
}

vec3 xyYToXYZ(vec3 xyY)
{
    if(xyY.y == 0.0f)
    {
        return vec3(0, 0, 0);
    }

    float Y = xyY.z;
    float X = (xyY.x * Y) / xyY.y;
    float Z = ((1.0f - xyY.x - xyY.y) * Y) / xyY.y;

    return vec3(X, Y, Z);
}

vec3 Unproject(vec2 xy)
{
    return xyYToXYZ(vec3(xy.x, xy.y, 1));				
}

mat3 PrimariesToMatrix(vec2 xy_red, vec2 xy_green, vec2 xy_blue, vec2 xy_white)
{
    vec3 XYZ_red = Unproject(xy_red);
    vec3 XYZ_green = Unproject(xy_green);
    vec3 XYZ_blue = Unproject(xy_blue);

    vec3 XYZ_white = Unproject(xy_white);

    mat3 temp = mat3(XYZ_red.x,	XYZ_green.x, XYZ_blue.x,
                     1.0f, 1.0f, 1.0f,
                     XYZ_red.z,	XYZ_green.z, XYZ_blue.z);

    mat3 inverse = InverseMat(temp);
    vec3 scale =  XYZ_white * inverse;

    return mat3(scale.x * XYZ_red.x, scale.y * XYZ_green.x,	scale.z * XYZ_blue.x,
                scale.x * XYZ_red.y, scale.y * XYZ_green.y,	scale.z * XYZ_blue.y,
                scale.x * XYZ_red.z, scale.y * XYZ_green.z,	scale.z * XYZ_blue.z);
}

mat3 ComputeCompressionMatrix(vec2 xyR, vec2 xyG, vec2 xyB, vec2 xyW, float compression)
{
    float scale_factor = 1.0f / (1.0f - compression);
    vec2 R = ((xyR - xyW) * scale_factor) + xyW;
    vec2 G = ((xyG - xyW) * scale_factor) + xyW;
    vec2 B = ((xyB - xyW) * scale_factor) + xyW;
    vec2 W = xyW;

    return PrimariesToMatrix(R, G, B, W);
}


vec3 OpenDomainToNormalizedLog2(vec3 openDomain, float minimum_ev, float maximum_ev)
{
    float total_exposure = maximum_ev - minimum_ev;

    vec3 output_log = clamp(log2(openDomain / MIDDLE_GREY), minimum_ev, maximum_ev);

    return (output_log - minimum_ev) / total_exposure;
}


float AgXScale(float x_pivot, float y_pivot, float slope_pivot, float power)
{
    return pow(pow((slope_pivot * x_pivot), -power) * (pow((slope_pivot * (x_pivot / y_pivot)), power) - 1.0), -1.0 / power);
}

float AgXHyperbolic(float x, float power)
{
    return x / pow(1.0 + pow(x, power), 1.0f / power);
}

float AgXTerm(float x, float x_pivot, float slope_pivot, float scale)
{
    return (slope_pivot * (x - x_pivot)) / scale;
}

float AgXCurve(float x, float x_pivot, float y_pivot, float slope_pivot, float toe_power, float shoulder_power, float scale)
{
    if(scale < 0.0f)
    {
        return scale * AgXHyperbolic(AgXTerm(x, x_pivot, slope_pivot, scale), toe_power) + y_pivot;
    }
    else
    {
        return scale * AgXHyperbolic(AgXTerm(x,x_pivot, slope_pivot,scale), shoulder_power) + y_pivot;
    }
}

float AgXFullCurve(float x, float x_pivot, float y_pivot, float slope_pivot, float toe_power, float shoulder_power)
{
    float scale_x_pivot = x >= x_pivot ? 1.0f - x_pivot : x_pivot;
    float scale_y_pivot = x >= x_pivot ? 1.0f - y_pivot : y_pivot;

    float toe_scale = AgXScale(scale_x_pivot, scale_y_pivot, slope_pivot, toe_power);
    float shoulder_scale = AgXScale(scale_x_pivot, scale_y_pivot, slope_pivot, shoulder_power);				

    float scale = x >= x_pivot ? shoulder_scale : -toe_scale;

    return AgXCurve(x, x_pivot, y_pivot, slope_pivot, toe_power, shoulder_power, scale);
}

vec3 Tonemap_ACES_Simple(vec3 x) 
{
    const float a = 2.51;
    const float b = 0.03;
    const float c = 2.43;
    const float d = 0.59;
    const float e = 0.14;
    return (x * (a * x + b)) / (x * (c * x + d) + e);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    float h = floor(1.0+24.0*fragCoord.y/iResolution.y)/24.0 * 3.141592 * 2.;
    float L = floor(fragCoord.x*24.0/iResolution.y)/(24.0/iResolution.y)/iResolution.x - 0.4;
    vec3 color = cos(h + vec3(0.0,1.0,2.0)* 3.141592*2.0/3.0);
    float maxRGB = max(color.r, max(color.g, color.b));
    float minRGB = min(color.r, min(color.g, color.b));

    color = exp(15.0*L)*(color-minRGB)/(maxRGB-minRGB);

    vec3 workingColor = max(color, 0.0f) * pow(2.0f, EXPOSURE);

    mat3 sRGB_to_XYZ = PrimariesToMatrix(vec2(0.64,0.33),
                                         vec2(0.3,0.6), 
                                         vec2(0.15,0.06), 
                                         vec2(0.3127, 0.3290));

    mat3 adjusted_to_XYZ = ComputeCompressionMatrix(vec2(0.64,0.33),
                                                    vec2(0.3,0.6), 
                                                    vec2(0.15,0.06), 
                                                    vec2(0.3127, 0.3290), COMPRESSION);

    mat3 XYZ_to_adjusted = InverseMat(adjusted_to_XYZ);

    vec3 xyz = workingColor * sRGB_to_XYZ;
    vec3 adjustedRGB = xyz * XYZ_to_adjusted;

    float x_pivot = abs(MIN_EV) / (MAX_EV - MIN_EV);
    float y_pivot = 0.5f;

    vec3 logV = OpenDomainToNormalizedLog2(adjustedRGB, MIN_EV, MAX_EV);

    float outputR = AgXFullCurve(logV.r, x_pivot, y_pivot, SLOPE, TOE_POWER, SHOULDER_POWER);
    float outputG = AgXFullCurve(logV.g, x_pivot, y_pivot, SLOPE, TOE_POWER, SHOULDER_POWER);
    float outputB = AgXFullCurve(logV.b, x_pivot, y_pivot, SLOPE, TOE_POWER, SHOULDER_POWER);

    workingColor = clamp(vec3(outputR, outputG, outputB), 0.0, 1.0);

    vec3 luminanceWeight = vec3(0.2126729f,  0.7151522f,  0.0721750f);
    vec3 desaturation = vec3(dot(workingColor, luminanceWeight));
    workingColor = mix(desaturation, workingColor, SATURATION);
    workingColor = clamp(workingColor, 0.f, 1.f);

    // Lerp between raw and image
    workingColor = mix(color, workingColor, AGX_LERP);	

// #if !SHOW_ACES
	color = workingColor;
// #else
    color = Tonemap_ACES_Simple(color);
// #endif

	fragColor = vec4(color,1.0);
}

void main() {
    // print("Tonemap!");
    // print(Tonemap_ACES_Simple(vec3(1.0, 2.0, 3.0)));
    // print(OpenDomainToNormalizedLog2(vec3(1.0, 2.0, 3.0), MIN_EV, MAX_EV));

    float v = 3.0f;
    test_inout(v);
    print(v);
}
    `);

    const exec = new Exec.Exec(mod, 'GLSL');
    exec.evalFunction('main');
}

main();
