# Ruteo de CommandCode en 9router

Archivos fuente (build compilado de Next.js):

- `~/.nvm/versions/node/v24.16.0/lib/node_modules/9router/app/.next-cli-build/server/chunks/1275.js`
- `~/.nvm/versions/node/v24.16.0/lib/node_modules/9router/app/.next-cli-build/server/chunks/318.js`
- `~/.nvm/versions/node/v24.16.0/lib/node_modules/9router/app/.next-cli-build/server/chunks/8895.js`

---

## 1. Provider Enum — Módulo 14170 (`chunks/1275.js`)

Define los identificadores de todos los proveedores soportados.

```js
14170:(a,b,c)=>{
  c.d(b,{h:()=>d,t:()=>e});
  let d={
    OPENAI:"openai",
    OPENAI_RESPONSES:"openai-responses",
    OPENAI_RESPONSE:"openai-response",
    CLAUDE:"claude",
    GEMINI:"gemini",
    GEMINI_CLI:"gemini-cli",
    VERTEX:"vertex",
    CODEX:"codex",
    ANTIGRAVITY:"antigravity",
    KIRO:"kiro",
    CURSOR:"cursor",
    OLLAMA:"ollama",
    COMMANDCODE:"commandcode"
  };
  function e(a,b){
    return a.includes("/v1/responses")?d.OPENAI_RESPONSES
      :a.includes("/v1/messages")?d.CLAUDE
      :a.includes("/v1/chat/completions")&&Array.isArray(b?.input)?d.OPENAI
      :null
  }
}
```

---

## 2. Constantes de tipos — Módulo 55673 (`chunks/1275.js`)

Constantes usadas por todos los converters para construir bloques de contenido tipado.

```js
55673:(a,b,c)=>{
  c.d(b,{
    R4:()=>g, BY:()=>l, a_:()=>j.a_, RV:()=>e, rP:()=>k,
    x4:()=>f, bC:()=>j.bC, Du:()=>h, z7:()=>d, m8:()=>i
  });
  let d={USER:"user",ASSISTANT:"assistant",TOOL:"tool",SYSTEM:"system",DEVELOPER:"developer"};
  let e={USER:"user",MODEL:"model"};
  let f={
    TEXT:"text", IMAGE_URL:"image_url", IMAGE:"image",
    INPUT_AUDIO:"input_audio", AUDIO_URL:"audio_url",
    FILE:"file", FUNCTION:"function"
  };
  let g={
    TEXT:"text", IMAGE:"image", DOCUMENT:"document",
    TOOL_USE:"tool_use", TOOL_RESULT:"tool_result",
    THINKING:"thinking", REDACTED_THINKING:"redacted_thinking"
  };
  let h={
    MESSAGE:"message", FUNCTION_CALL:"function_call",
    FUNCTION_CALL_OUTPUT:"function_call_output",
    REASONING:"reasoning", OUTPUT_TEXT:"output_text",
    INPUT_TEXT:"input_text", INPUT_IMAGE:"input_image",
    SUMMARY_TEXT:"summary_text"
  };
  let i=[f.TEXT,f.IMAGE_URL,f.IMAGE,f.INPUT_AUDIO,f.AUDIO_URL,f.FILE];
  var j=c(69320);
  let k="unknown", l="image/png";
}
```

| Constante | Propósito |
|-----------|-----------|
| `z7` | Roles de mensaje (user, assistant, tool, system, developer) |
| `x4` | Tipos de contenido en requests (text, image_url, image, input_audio, etc.) |
| `R4` | Tipos de bloques de contenido en responses (text, image, document, tool_use, tool_result, thinking) |
| `Du` | Tipos de items del Responses API de OpenAI |
| `m8` | Array de tipos multimedia permitidos en requests |
| `rP` | String `"unknown"` para modelo desconocido |
| `BY` | Media type default `"image/png"` |

---

## 3. Conversor OPENAI → COMMANDCODE (Request) — Módulo 97821 (`chunks/1275.js`)

**Export:** `l` (función `j`).  
**Registrado como:** `d.kz(OPENAI, COMMANDCODE, j, null)`

Convierte un request en formato OpenAI Chat Completions al formato nativo de CommandCode (`api.commandcode.ai/alpha/generate`).

```js
97821:(a,b,c)=>{
  c.d(b,{l:()=>j});
  var d=c(78833), e=c(14170), f=c(55511), g=c(55673), h=c(41004);

  // Convierte contenido a string plano
  function i(a){
    if(null==a) return "";
    if("string"==typeof a) return a;
    if(Array.isArray(a)){
      let b=[];
      for(let c of a)
        "string"==typeof c ? b.push(c)
          : c&&"object"==typeof c&&"string"==typeof c.text && b.push(c.text);
      return b.join("\n");
    }
    return String(a);
  }

  function j(a,b,c){
    // Procesa mensajes: mapea roles de OpenAI → CommandCode
    let {messages:d, system:e} = function(a=[]){
      let b=[], c=[];
      for(let d of a){
        if(!d) continue;
        let a=d.role;
        // SYSTEM → sistema (texto plano)
        if(a===g.z7.SYSTEM){
          let a=i(d.content); a&&c.push(a); continue;
        }
        // TOOL → tool-result
        if(a===g.z7.TOOL){
          let a="string"==typeof d.content?d.content:i(d.content);
          b.push({
            role:g.z7.TOOL,
            content:[{
              type:"tool-result",
              toolCallId:d.tool_call_id||"",
              toolName:d.name||"",
              output:{type:"text", value:a}
            }]
          });
          continue;
        }
        // ASSISTANT → text + tool-call
        if(a===g.z7.ASSISTANT){
          let a=[], c=i(d.content);
          if(c&&a.push({type:g.x4.TEXT, text:c}),
             Array.isArray(d.tool_calls))
            for(let b of d.tool_calls){
              let c=b.function||{};
              a.push({
                type:"tool-call",
                toolCallId:b.id||"",
                toolName:c.name||"",
                input:function(a){
                  if(null==a) return {};
                  if("string"!=typeof a) return a;
                  try{return JSON.parse(a)}catch{return {}}
                }(c.arguments)
              });
            }
          b.push({
            role:g.z7.ASSISTANT,
            content:a.length?a:[{type:g.x4.TEXT, text:""}]
          });
          continue;
        }
        // USER → text / image / tool-result
        b.push({
          role:g.z7.USER,
          content:function(a){
            if(null==a) return [{type:g.x4.TEXT, text:""}];
            if("string"==typeof a) return [{type:g.x4.TEXT, text:a}];
            if(Array.isArray(a)){
              let b=[];
              for(let c of a)
                "string"==typeof c
                  ? b.push({type:g.x4.TEXT, text:c})
                  : c&&"object"==typeof c && (
                      c.type===g.x4.TEXT&&"string"==typeof c.text
                        ? b.push({type:g.x4.TEXT, text:c.text})
                      : c.type===g.x4.IMAGE_URL               // image_url → {type:"image", image:"data:..."}
                        ? b.push({type:"image", image:c.image_url?.url||""})
                      : c.type===g.x4.IMAGE                    // image → reconstruye data URI
                        ? b.push({type:"image",
                            image:c.source?.data
                              ? `data:${c.source?.media_type||"image/png"};base64,${c.source.data}`
                              : ""})
                      : "string"==typeof c.text && b.push({type:g.x4.TEXT, text:c.text})
                    );
              return b.length ? b : [{type:g.x4.TEXT, text:""}];
            }
            return [{type:g.x4.TEXT, text:String(a)}];
          }(d.content)
        });
      }
      return {messages:b, system:c.join("\n\n")};
    }(b.messages);

    // Construye el body CommandCode
    let j={
      model:a,
      messages:d,
      stream:!1!==c,
      max_tokens:b.max_tokens??b.max_output_tokens??h.Uc,
      temperature:b.temperature??.3
    };
    e&&(j.system=e);

    // Convierte tools (OpenAI function → CommandCode {name,description,input_schema})
    let k=function(a){
      if(!Array.isArray(a)||0===a.length) return;
      let b=[];
      for(let c of a)
        c&&(
          c.type===g.x4.FUNCTION&&c.function
            ? b.push({
                name:c.function.name,
                description:c.function.description,
                input_schema:c.function.parameters||{type:"object"}
              })
            : c.name&&(c.input_schema||c.parameters) &&
              b.push({
                name:c.name,
                description:c.description,
                input_schema:c.input_schema||c.parameters
              })
        );
      return b.length ? b : void 0;
    }(b.tools);
    k&&(j.tools=k);

    null!=b.top_p && (j.top_p=b.top_p);

    // Envuelve con metadatos de sesión
    let l=new Date().toISOString().slice(0,10);
    return {
      threadId:(0,f.randomUUID)(),
      memory:"",
      config:{
        workingDir:process.cwd(),
        date:l,
        environment:process.platform,
        structure:[],
        isGitRepo:!1,
        currentBranch:"",
        mainBranch:"",
        gitStatus:"",
        recentCommits:[]
      },
      params:j
    };
  }
  // Registro del conversor
  (0,d.kz)(e.h.OPENAI, e.h.COMMANDCODE, j, null)
}
```

### Mapeo de formatos

| OpenAI | CommandCode |
|--------|-------------|
| `role:"system"` | `system` (texto plano) |
| `role:"user"` + `{type:"text",text}` | `{role:"user", content:[{type:"text",text}]}` |
| `role:"user"` + `{type:"image_url", image_url:{url}}` | `{role:"user", content:[{type:"image", image:"data:..."}]}` |
| `role:"assistant"` + `content + tool_calls[]` | `{role:"assistant", content:[{type:"text"}, {type:"tool-call",toolCallId,toolName,input}]}` |
| `role:"tool"` | `{role:"tool", content:[{type:"tool-result",toolCallId,toolName,output:{type:"text",value}}]}` |
| `tools[]` (function) | `tools[]` con `{name,description,input_schema}` |
| `max_tokens` / `max_output_tokens` | `params.max_tokens` |
| `temperature` (default .3) | `params.temperature` |
| `top_p` | `params.top_p` |
| `stream` | `params.stream` (siempre true forzado por el handler) |

---

## 4. Conversor COMMANDCODE → OPENAI (Response Stream) — Módulo 47723 (`chunks/1275.js`)

**Export:** `H` (función `n`).  
**Registrado como:** `d.kz(COMMANDCODE, OPENAI, null, n)`

Convierte el stream SSE de CommandCode a chunks de `chat.completion.chunk` de OpenAI.

```js
47723:(a,b,c)=>{
  c.d(b,{H:()=>n});
  var d=c(78833), e=c(14170), f=c(55673), g=c(32271), h=c(34097),
      i=c(44090), j=c(17242), k=c(21855);

  function l(a,b,c=null){
    return (0,g.k)({
      id:a.responseId, created:a.created, model:a.model
    }, b, c);
  }

  let m=a=>(0,k.F)(a,"commandcode");

  function n(a,b){
    var c;
    if(!a) return null;
    if(a&&"object"==typeof a&&"chat.completion.chunk"===a.object) return a;

    let d=a;
    // Parse SSE string → JSON
    if("string"==typeof a){
      let b=a.trim();
      if(!b) return null;
      let c=b.startsWith("data:")?b.slice(5).trim():b;
      if(!c||"[DONE]"===c) return null;
      try{d=JSON.parse(c)}catch{return null}
    }
    if(!d||"object"!=typeof d||!d.type) return null;

    c=d.model;
    // Inicializa estado del chunk
    b.responseId||(
      b.responseId=`chatcmpl-${Date.now()}`,
      b.created=Math.floor(Date.now()/1e3),
      b.model=b.model||c||"commandcode",
      b.chunkIndex=0,
      b.toolIndex=0,
      b.toolIndexById=new Map,
      b.openTools=new Set,
      b.openText=!1,
      b.finishReason=null,
      b.usage=null
    );

    let e=[];
    switch(d.type){
      case"text-delta":{
        let a=d.text||d.delta||"";
        if(!a) break;
        let c=0===b.chunkIndex
          ? {role:f.z7.ASSISTANT, content:a}
          : {content:a};
        b.chunkIndex++, b.openText=!0, e.push(l(b,c));
        break;
      }
      case"reasoning-delta":{
        let a=d.text||"";
        if(!a) break;
        let c=(0,i.B)(a, 0===b.chunkIndex);
        b.chunkIndex++, e.push(l(b,c));
        break;
      }
      case"tool-input-start":{
        let a=d.id||d.toolCallId||(0,j.eG)(b.toolIndex),
            c=b.toolIndexById.get(a);
        null==c&&(c=b.toolIndex++, b.toolIndexById.set(a,c));
        b.openTools.add(a);
        let g={
          ...(0===b.chunkIndex?{role:f.z7.ASSISTANT}:{}),
          tool_calls:[{
            index:c, id:a, type:f.x4.FUNCTION,
            function:{name:d.toolName||"", arguments:""}
          }]
        };
        b.chunkIndex++, e.push(l(b,g));
        break;
      }
      case"tool-input-delta":{
        let a=d.id||d.toolCallId,
            c=b.toolIndexById.get(a);
        if(null==c) break;
        let f={tool_calls:[{index:c, function:{arguments:d.delta||d.inputTextDelta||""}}]};
        e.push(l(b,f));
        break;
      }
      case"tool-call":{
        let a=d.toolCallId;
        if(b.toolIndexById.has(a)) break;
        let c=b.toolIndex++;
        b.toolIndexById.set(a,c);
        let g="string"==typeof d.input?d.input:JSON.stringify(d.input??{}),
            h={...(0===b.chunkIndex?{role:f.z7.ASSISTANT}:{}),
              tool_calls:[{
                index:c, id:a, type:f.x4.FUNCTION,
                function:{name:d.toolName||"", arguments:g}
              }]
            };
        b.chunkIndex++, e.push(l(b,h));
        break;
      }
      case"finish-step":
        b.finishReason=m(d.finishReason), d.usage&&(b.usage=d.usage);
        break;
      case"finish":{
        let a=b.finishReason||m(d.finishReason||"stop"),
            c=l(b,{},a),
            f=d.totalUsage||b.usage,
            g=(0,h.B)(f,"commandcode");
        g&&(c.usage=g), e.push(c);
        break;
      }
      case"error":{
        b.finishReason=f.bC.STOP;
        let a=d.error??d.message??"unknown",
            c="string"==typeof a?a:JSON.stringify(a);
        e.push(l(b,{content:`\n\n[CommandCode error: ${c}]`})),
        e.push(l(b,{},f.bC.STOP));
        break;
      }
    }
    return e.length?e:null;
  }
  // Registro del conversor de respuesta
  (0,d.kz)(e.h.COMMANDCODE, e.h.OPENAI, null, n)
}
```

### Mapeo de eventos SSE

| CommandCode SSE event | OpenAI chunk equivalente |
|----------------------|--------------------------|
| `{type:"text-delta", text:"..."}` | `choices[0].delta.content` |
| `{type:"reasoning-delta", text:"..."}` | `choices[0].delta.reasoning_content` |
| `{type:"tool-input-start", id, toolName}` | `choices[0].delta.tool_calls[0]` con `arguments:""` |
| `{type:"tool-input-delta", id, delta}` | `choices[0].delta.tool_calls[0].function.arguments` |
| `{type:"tool-call", toolCallId, toolName, input}` | `choices[0].delta.tool_calls[0]` con arguments completos |
| `{type:"finish-step", finishReason}` | Almacena internamente finishReason + usage |
| `{type:"finish", finishReason, totalUsage}` | Último chunk con `finish_reason` + `usage` |
| `{type:"error", error}` | Chunk con texto de error + `finish_reason:"stop"` |

---

## 5. Handler Class — Módulo 90926 (`chunks/318.js`)

**Export:** `A` (clase `i`).  
Clase handler del proveedor CommandCode, orquesta el envío HTTP y el pipeo del stream.

```js
90926:(a,b,c)=>{
  c.d(b,{A:()=>i});
  var d=c(55511), e=c(74957), f=c(35024), g=c(47723), h=c(78959);

  class i extends e.H {
    constructor(){
      super("commandcode", f.xq.commandcode);
    }

    // Fuerza streaming activo
    transformRequest(a,b,c,d){
      return b.stream=!0, b;
    }

    // Construye headers HTTP
    buildHeaders(a,b=!0){
      let c={
        "Content-Type":"application/json",
        ...this.config.headers||{},
        "x-session-id":(0,d.randomUUID)()
      };
      let e=a?.apiKey||a?.accessToken;
      return e&&(c.Authorization=`Bearer ${e}`),
             b&&(c.Accept="text/event-stream"),
             c;
    }

    // Ejecuta el request y pipea el stream SSE
    async execute(a){
      var b,c,d,e,f,i,j,k,l;
      let m=await super.execute(a);
      if(m?.response?.ok && m.response.body){
        b=m.response;
        c=a.model;
        d=new TextDecoder;
        e=new TextEncoder;
        f="";
        i={model:c};

        // Formatea datos como eventos SSE
        j=(a,b)=>{
          if(a) for(let c of Array.isArray(a)?a:[a])
            null!=c && b.enqueue(e.encode(`data: ${JSON.stringify(c)}\n\n`));
        };

        // TransformStream: parsea SSE linea por linea
        k=new TransformStream({
          transform(a,b){
            let c=(f+=d.decode(a,{stream:!0})).split("\n");
            for(let a of (f=c.pop()||"", c)){
              let c=a.trim();
              c&&j((0,g.H)(c,i), b);
            }
          },
          flush(a){
            let b=f.trim();
            b&&j((0,g.H)(b,i), a);
            a.enqueue(e.encode(h.$U));  // "[DONE]"
          }
        });

        m.response=new Response(
          b.body.pipeThrough(k),
          {status:b.status, statusText:b.statusText, headers:b.headers}
        );
      }
      return m;
    }
  }
}
```

### Flujo del handler

```
execute() llama a super.execute() → fetch HTTP a api.commandcode.ai
     │
     ▼
response.body (stream SSE crudo)
     │
     ▼
TransformStream:
  1. Acumula bytes en buffer string
  2. Divide por "\n"
  3. Cada línea → trim → module 47723.H() → OpenAI chunk(s)
  4. OpenAI chunks → "data: {...}\n\n"
     │
     ▼
Response con body transformado (OpenAI-format SSE)
```

---

## 6. Enrutador central — Módulo 78833 (`chunks/1275.js`)

Función `ab` — orquesta todo el pipeline de conversión.

```js
function ab(a,b,c,e,o=!0,p=null,q=null,r=null,s=[],t=null,u=null){
  let v=e;

  // 1. Filtro por capacidades (imagen/audio/pdf)
  !function(a,b=[]){
    if(!b.length||!a.messages||!Array.isArray(a.messages)) return;
    let c=new Set(["image_url","image"]),
        d=new Set(["audio_url","input_audio"]),
        e=a=>c.has(a)?b.includes("image"):!!d.has(a)&&b.includes("audio");
    for(let b of a.messages)
      Array.isArray(b.content)&&(
        b.content=b.content.filter(a=>!e(a.type)),
        0===b.content.length&&(b.content="")
      );
  }(v,s);

  // 2. Sanitización
  (0,k.SZ)(v);    // sistema
  (0,g.fH)(v);    // tool call IDs
  (0,g.SF)(v);    // validación IDs

  // 3. Config de thinking
  let w=(0,l.NU)(v);
  let x=(0,m.YC)(v,p,t,b);
  if(p&&(p._clientSessionId=x), a!==b){
    // 4. Busca conversor: source→target
    let e=d.get(`${a}:${b}`);
    if(e) v=e(c,v,o,p);
    else {
      // Fallback via OpenAI intermedio
      if(a!==f.h.OPENAI){
        let b=d.get(`${a}:${f.h.OPENAI}`);
        b&&(v=b(c,v,o,p), r?.logOpenAIRequest?.(v));
      }
      if(b!==f.h.OPENAI){
        let a=d.get(`${f.h.OPENAI}:${b}`);
        a&&(v=a(c,v,o,p));
      }
    }
  }
  // 5. Cleanup target-specific
  if(b===f.h.OPENAI) v=function(a){...}(v);
  if(b===f.h.CLAUDE) v=(0,h.Bz)(v,q,a,t,p?.rawHeaders,x);
  return v;
}
```

### Registro de conversores (`aa` / `d.kz`)

```js
function aa(a,b,c,f){
  d??=new Map, e??=new Map;
  let g=`${a}:${b}`;
  c&&d.set(g,c);   // request converters
  f&&e.set(g,f);   // response converters
}
```

Todos los registros encontrados:

| # | Llamada | Propósito |
|---|---------|-----------|
| 1 | `d.kz(OPENAI, OPENAI_RESPONSES, null, fn)` | Response: OpenAI → OpenAI-Responses |
| 2 | `d.kz(OPENAI_RESPONSES, OPENAI, null, r)` | Response: OpenAI-Responses → OpenAI |
| 3 | `d.kz(OPENAI, CLAUDE, l, null)` | Request: OpenAI → Claude |
| 4 | `d.kz(OLLAMA, OPENAI, null, fn)` | Response: Ollama → OpenAI |
| **5** | **`d.kz(COMMANDCODE, OPENAI, null, n)`** | **Response: CommandCode → OpenAI** |
| 6 | `d.kz(CLAUDE, OPENAI, k, null)` | Request: Claude → OpenAI |
| 7 | `d.kz(OPENAI_RESPONSES, OPENAI, fn, null)` | Request: OpenAI-Responses → OpenAI |
| 8 | `d.kz(OPENAI, OPENAI_RESPONSES, j, null)` | Request: OpenAI → OpenAI-Responses |
| **9** | **`d.kz(OPENAI, COMMANDCODE, j, null)`** | **Request: OpenAI → CommandCode** |

---

## 7. Mapeo de Finish Reasons — Módulo 21855 (`chunks/1275.js`)

Traduce finish reasons específicos de CommandCode al sistema interno de 4 estados.

```js
21855:(a,b,c)=>{
  c.d(b,{F:()=>e, Q:()=>f});
  var d=c(69320);

  function e(a,b){
    switch(b){
      case"commandcode":
        switch(a){
          case"stop": case"error": return d.bC.STOP;
          case"length": return d.bC.LENGTH;
          case"tool-calls": case"tool_use": return d.bC.TOOL_CALLS;
          case"content-filter": return d.bC.CONTENT_FILTER;
          default: return a||d.bC.STOP;
        }
      // ... otros providers
    }
  }
}
```

| CommandCode | Interno |
|-------------|---------|
| `"stop"`, `"error"` | `STOP` |
| `"length"` | `LENGTH` |
| `"tool-calls"`, `"tool_use"` | `TOOL_CALLS` |
| `"content-filter"` | `CONTENT_FILTER` |

---

## 8. Filtro por capacidades del modelo — Módulo 5263 (`chunks/8895.js`)

**Export:** `X` (función `m`).  
Elimina contenido no soportado (imagen/audio/pdf) según las capacidades del modelo.

```js
5263:(a,b,c)=>{
  c.d(b,{X:()=>m});
  var d=c(14170);

  let e={
    vision:"[image omitted: model has no vision support]",
    audioInput:"[audio omitted: model has no audio support]",
    pdf:"[file omitted: model has no document support]"
  };
  let f={
    vision:"[Previous image omitted from context.]",
    audioInput:"[Previous audio omitted from context.]",
    pdf:"[Previous file omitted from context.]"
  };

  function h(a){      // Detecta tipo no soportado (OpenAI-style)
    let b=a?.type;
    return "image_url"===b||"image"===b ? "vision"
         : "input_audio"===b||"audio_url"===b ? "audioInput"
         : "file"===b ? "pdf" : null;
  }

  function i(a){      // Detecta tipo no soportado (Claude-style)
    let b=a?.type;
    return "image"===b ? "vision" : "document"===b ? "pdf" : null;
  }

  function m(a,b,c){
    if(!a||!c||!1!==c.vision&&!1!==c.audioInput&&!1!==c.pdf) return !1;
    switch(b){
      case d.h.OPENAI:
      case d.h.OLLAMA:
      case d.h.KIRO:
      case d.h.CURSOR:
      case d.h.COMMANDCODE:
        // Filtra messages[].content[]
        k(a,c);
        break;
      // ... otros providers
    }
    return !0;
  }
}
```

CommandCode usa el mismo filtro que OpenAI: revisa `messages[].content[]` y reemplaza items no soportados con texto placeholder. Esto es **independiente** del conversor de formato — ocurre antes, en la etapa de routing.

---

## 9. Diagrama de flujo completo

```
  Request entrante (formato OPENAI/CLAUDE/etc)
         │
         ▼
  ┌──────────────────────────────────────────┐
  │        MODULE 78833 — ab()               │
  │                                          │
  │  1. Filtro capacidades (mod 5263)        │
  │  2. Sanitización de mensajes             │
  │  3. Config de thinking                   │
  │  4. Busca conversor:                     │
  │     a) Directo (source:target)           │
  │     b) Via OPENAI (si no hay directo)    │
  │  5. Aplica conversor                     │
  │  6. Cleanup específico del target        │
  └──────────────┬───────────────────────────┘
                 │
                 ▼  (body transformado)
  ┌──────────────────────────────────────────┐
  │  MODULE 90926 — Handler class i          │
  │                                          │
  │  transformRequest: forces stream=true    │
  │  buildHeaders: Authorization, x-session  │
  │  execute:                                │
  │    → super.execute() (fetch HTTP)        │
  │    → pipe body through TransformStream   │
  └──────────────┬───────────────────────────┘
                 │
                 ▼  (HTTP POST a api.commandcode.ai)
         ┌──────────────────┐
         │  CommandCode API  │
         │  /alpha/generate  │
         └────────┬─────────┘
                  │  (SSE stream)
                  ▼
  ┌──────────────────────────────────────────┐
  │  TransformStream en execute()            │
  │                                          │
  │  1. Acumula buffer                       │
  │  2. Divide por "\n"                      │
  │  3. Cada línea → module 47723.H()        │
  │     (COMMANDCODE → OpenAI chunk)         │
  │  4. Re-empaqueta como "data: {...}\n\n"  │
  │  5. Append final "[DONE]"                │
  └──────────────┬───────────────────────────┘
                 │
                 ▼  (OpenAI-format SSE stream)
         Cliente original
```

---

## 10. Resumen de archivos

| Archivo | Módulos relevantes |
|---------|-------------------|
| `chunks/1275.js` | **14170** (enum providers), **55673** (type constants), **97821** (OPENAI→COMMANDCODE request converter), **47723** (COMMANDCODE→OPENAI response converter), **78833** (router `ab` + `aa`/`kz`), **21855** (finish reason mapping) |
| `chunks/318.js` | **90926** (CommandCode handler class `i`) |
| `chunks/8895.js` | **5263** (capability filter) + response normalization logic |
