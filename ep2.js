
"use strict";

// ==================================================================
// constantes globais

const FUNDO = [0, 1, 1, 1];
const DISCO_RES = 3;
const DISCO_UMA_COR = true;

// ==================================================================
// variáveis globais
var gl;
var gCanvas;
var gShader = {};  // encapsula globais do shader

// Os códigos fonte dos shaders serão descritos em
// strings para serem compilados e passados a GPU
var gVertexShaderSrc;
var gFragmentShaderSrc;

// Define o objeto a ser desenhado: uma lista de vértices
// com coordenadas no intervalo (0,0) a (200, 200)
var gPosicoes = [];
var gCores = [];
var gObjetos = [];
var gUltimoT = Date.now();


var gRotacao = 0.0;
// ==================================================================
window.onload = main;

function main() {
    gCanvas = document.getElementById("glcanvas");
    gl = gCanvas.getContext('webgl2');
    if (!gl) alert("WebGL 2.0 isn't available");

    gObjetos.push(new Triangulo(200, 200, sorteieInteiro(30, 40), 50, 50, sorteieCorRGBA()));
    //gObjetos.push(new Triangulo(150, 240, sorteieInteiro(30, 40), 150, -70, sorteieCorRGBA()));

    crieShaders();

    gl.clearColor(FUNDO[0], FUNDO[1], FUNDO[2], FUNDO[3]);

    desenhe();
}


function crieShaders() {
    //  cria o programa
    gShader.program = makeProgram(gl, gVertexShaderSrc, gFragmentShaderSrc);
    gl.useProgram(gShader.program);

    // carrega dados na GPU
    gShader.bufPosicoes = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, gShader.bufPosicoes);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(gPosicoes), gl.STATIC_DRAW);

    // Associa as variáveis do shader ao buffer gPosicoes
    var aPositionLoc = gl.getAttribLocation(gShader.program, "aPosition");
    // Configuração do atributo para ler do buffer
    // atual ARRAY_BUFFER
    let size = 2;          // 2 elementos de cada vez - vec2
    let type = gl.FLOAT;   // tipo de 1 elemento = float 32 bits
    let normalize = false; // não normalize os dados
    let stride = 0;        // passo, quanto avançar a cada iteração depois de size*sizeof(type)
    let offset = 0;        // começo do buffer
    gl.vertexAttribPointer(aPositionLoc, size, type, normalize, stride, offset);
    gl.enableVertexAttribArray(aPositionLoc);

    // buffer de cores
    var bufCores = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufCores);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(gCores), gl.STATIC_DRAW);
    var aColorLoc = gl.getAttribLocation(gShader.program, "aColor");
    gl.vertexAttribPointer(aColorLoc, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aColorLoc);

    // resolve os uniforms
    gShader.uResolution = gl.getUniformLocation(gShader.program, "uResolution");
    gShader.uTranslation = gl.getUniformLocation(gShader.program, "uTranslation");

}


function desenhe() {
    let now = Date.now();
    let delta = (now - gUltimoT) / 1000;
    gUltimoT = now;

    gRotacao = (gRotacao + delta*100)%360

    // desenha vertices
    gPosicoes = [];
    for (let i = 0; i < gObjetos.length; i++)
        gObjetos[i].atualize(delta);

    // atualiza o buffer de vertices
    gl.bindBuffer(gl.ARRAY_BUFFER, gShader.bufPosicoes);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(gPosicoes), gl.STATIC_DRAW);

    gl.uniform2f(gShader.uResolution, gCanvas.width, gCanvas.height);

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, gPosicoes.length);

    window.requestAnimationFrame(desenhe);
}

function aproximeTriangulo(raio)
{
    return [
        vec4(0, raio, 0, 1),
        vec4(raio/3, 0, 0, 1),
        vec4(-raio/3, 0, 0, 1) ]
}

function Triangulo (x, y, r, vx, vy, cor)
{
    this.vertices = aproximeTriangulo(r);
    this.nv = this.vertices.length;
    this.vel = vec4(vx, vy, 0, 0);
    this.cor = cor;
    this.pos = vec4(x, y, 0, 1);
    let nv = this.nv;
    let vert = this.vertices;

    for (let i = 0; i < nv; i++)
    {
        let matriz_r = rotate(0, vec3(0,0,1));
        let matriz_t = translate(x, y, 0);
        let M = mult(matriz_t, matriz_r)

        vert[i] = mult(M, vert[i]);
        gPosicoes.push(vec2(vert[i][0], vert[i][1]))
        gCores.push(cor);
        gCores.push(cor);
        gCores.push(cor);
    }

    this.atualize = function (delta)
    {
        this.pos = add(this.pos, mult(delta, this.vel));

        let x, y;
        let vx, vy;
        x = this.pos[0];
        y = this.pos[1];

        vx = this.vel[0];
        vy = this.vel[1];

        if (x < 0) { x = -x; vx = -vx; }
        if (y < 0) { y = -y; vy = -vy; }
        if (x >= gCanvas.width) { x = gCanvas.width; vx = -vx; }
        if (y >= gCanvas.height) { y = gCanvas.height; vy = -vy; }

        this.vel = vec4(vx, vy, 0, 0);

        let nv = this.nv;
        let vert = this.vertices;

        for (let i = 0; i < nv; i++)
        {
            let matriz_r = rotateZ(1)
            let matriz_t1 = translate(-x, -y, 0)
            let matriz_t2 = translate(x, y, 0)

            vert[i] = mult(matriz_t1, vert[i]);
            vert[i] = mult(matriz_r, vert[i]);
            vert[i] = mult(matriz_t2, vert[i]);

            vert[i] = add(vert[i], mult(delta, this.vel));

            gPosicoes.push(vec2(vert[i][0], vert[i][1]));
        }
    }
}


// -----------------------------------------------------------------------
// Código fonte do Webgl em GLSL

gVertexShaderSrc = `#version 300 es

// aPosition é um buffer de entrada
in vec2 aPosition;
uniform vec2 uResolution;
in vec4 aColor;  // buffer com a cor de cada vértice
out vec4 vColor; // varying -> passado ao fShader

void main() {
    vec2 escala1 = aPosition / uResolution;
    vec2 escala2 = escala1 * 2.0;
    vec2 clipSpace = escala2 - 1.0;

    gl_Position = vec4(clipSpace, 0, 1);
    vColor = aColor; 
}
`;

gFragmentShaderSrc = `#version 300 es

// Vc deve definir a precisão do FS.
// Use highp ("high precision") para desktops e mediump para mobiles.
precision highp float;

// out define a saída 
in vec4 vColor;
out vec4 outColor;

void main() {
  outColor = vColor;
}
`;