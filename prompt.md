我要請您幫我生成一個完整的圖表介面模組程式碼。這個程式碼的規格我整理成以下列表：

 - 他是一個 HTML 片段, 最外層僅有一個 `<div>`, 裡面至少且通常只有一個 `<script>` 標籤
 - 內部的 script 標籤只有一個屬性 `type`, 其值為 `@plotdb/block`
   這段 script 為驅動圖表的核心, 基於我自行開發的模組化元件 `@plotdb/block` 規格製作,
   但您不需要猜測此規格的內容, 我會在這裡完整的說明.
 - script 標籤內的程式碼由 `modules.exports = {}` 這個將物件指定給 `module.exports` 的程式做為開頭, 
   且僅有這行. 這其中指定的物件可能會相當複雜, 我在此僅為方便說明所以用一個空物件做代表.
 - 前述物件的最基本內容如下:

    {
      pkg: {
        extend: {ns: "local", name: "chartbase", path: "index.html", version: "main"},
        dependencies: []
      },
      init: function(opt) {
        opt.pubsub.fire("init", {mod: {
          config: {},
          dimension: {},
          init: function() {},
          sample: function() {
            return {raw: [], binding: {}}
          },
          bind: function() {},
          resize: function() {},
          render: function() {},
          destroy: function() {}
        }});
      }
    }

 - 上述物件中, 您可以:
   - 透過 `pkg.dependencies` 列表自由載入任何外部函式庫; 你想載入某個函式庫, 只需要在該列表中加入一個物件,
     此物件內僅含一個成員屬性 `url`, 此屬性指定到外部函式庫的 cdn 網址即可.
     載入的函式庫物件會在 init 函式被呼叫時, 可於 `opt.ctx` 物件中取得. 例如, 以下展示如何取得 echarts 實體:

     {
       pkg: {
         dependencies: [
           {url: "some-cdn-url-to/echarts.min.js"}
         ]
       },
       init: function(opt) { var echarts = opt.ctx.echarts; /* 後略 */}
     }

     這裡的 dependencies 會透過 fetch 取得, 所以請優先考慮使用有開放 CORS 權限的 CDN.

     請注意我們不支援 esm import / export 類型的函式庫載入, 因此您在選擇函式庫時, 必須使用以舊形式提供的函式庫檔案. 此外, opt.ctx 內的變數其大小寫跟原始函式庫一致, 因此如採用 `Highcharts` 時, 您會需要寫成:

     var Highcharts = opt.ctx.Highcharts;

   - 最外層 init 函式中的 `opt.root` 代表您目前模組的頂層 DOM 元件, 您可以在裡面自由的增刪 DOM 節點;
     但這通常會由您引用的圖表函式庫來進行, 所以您通常不會需要自行操作他.
   - 在最外層 init 函式中, 您可以自由在 opt.pubsub.fire 執行前做任意的初始化, 例如用 echarts 建構 chart 物件:

     {
       pkg: {
         extend: {ns: "local", name: "chartbase", version: "main"},
         dependencies: [
           {name: "echarts", path: "dist/echarts.min.js"}
         ]
       },
       init: function(opt) {
         var echarts = opt.ctx.echarts;
         var chart = echarts.init(root);
         opt.pubsub.fire("init", {mod: {
           render: function() {
             chart.resize();
           }
         }}
       }
     }

以上為這個模組的基本規格. 請注意, `pkg` 中的 `extend` 為固定寫法, 會協助我們處理使用 `@plotdb/chart` 的初始化步驟，所以不可省略. 您可以注意到我在模組中 init 函式裡, 透過 `opt.pubsub.fire` 發送了一個 `init` 事件 (此事件將在 `chartbase` 中處理). 這個事件並帶了一個參數物件, 內部僅含一個成員參數 `mod`, 該參數本身也是一個物件, 這個物件是我們自行定義的圖表介面.

## 基本框架

使用 `extend: {ns: "local", name: "chartbase", version: "main"}` 其實是載入一個本地的母模組，他會幫我們的 `mod` 物件準備一些方便的元件，並且在執行時可以透過 `this` 來存取，並且協助維護如 Responsive 的動態。

這些成員都有可能被母模組再利用，所以請不要覆寫他們。有需要儲存資料時，您可以自行準備一個本地變數來保存資料。

例如:

 - `this.svg`: 預設建立的 SVG 節點，這是一個標準的 DOM Element ，如果要用其它方式 (如 d3.select ) 操作他，請自行轉換後另外保存，不要覆寫他。
   - `chartbase` 會自動依據容器大小維護 `this.svg` 的大小與尺寸, 請不要自行去設定他的值.
 - `this.box`: 一個如 `{x,y,widht,height}` 這樣的物件，內含 SVG 節點的位置與尺寸。 `resize` 前會自動更新。

請注意，在模組 `init` 函式中的 `this` scope 與在 `mod` 物件中各函式裡的 `this` scope 是不同的:

    {
      pkg: {....},
      init: function() {
         var a = this;
         opt.pubsub.fire("init", {mod: {
           init: function() {
             a == this; /* will be false */
           }
      }
    }


## 人機介面定義規格

讀到這邊您應該已經了解, 我們透過外部載入函式庫, 然後自行編撰圖表介面物件的形式, 可以將所有圖表函式庫的介面一致化; 我們已經另外架設好對應這個內部介面的人機介面, 所以接下來只要針對世界上任何圖表函式庫再定義好他們對我們這個圖表介面轉換, 我們就可以使用我們的人機介面操作世界上任何的圖表函式庫. 但這個工程相當龐大, 也不是所有想使用的人都會寫程式, 因此這件事由您來做是最實際的了.

也因此, 您需要了解這個 `mod` 物件的介面是怎麼定義的. 如前述, 這個 `mod` 物件的基本屬性包含:

    {
      config: {},
      dimension: {},
      init: function() {},
      sample: function() {
        return {raw: [], binding: {}}
      },
      bind: function() {},
      resize: function() {},
      render: function() {},
      destroy: function() {}
    }

以下逐一說明其用途與規格.

 - config: 為一個物件, 每個成員屬性對應到一個用戶自由調整的參數. 每個屬性都是一個物件, 屬性鍵值為其 id, 物件中的欄位包含:
   - name: 字串, 給用戶看的參數名稱
   - type: 參數類型, 為 ["text", "number", "color", "palette"] 其中之一
   - 當 type 為 `number` 時, 您可以追加以下參數來做數值的進階設定:
     - default: 預設值.
     - min: 最小值
     - max: 最大值
     - step: 用戶用滑鼠移動介面 slider bar 時, 數值變化的最小單位
   - 當 type 為 `color` 時, 您可以使用網頁顏色 hex 碼設定 `default` 值, 例如 `#abcdef`
   - 當 type 為 `palette` 時, 您可以用一個含有 `color` 成員陣列的物件設定 `default` 值, 此成員陣列內含一至多個顏色的色碼字串, 例如:

     {colors: ["#123456", "#345678"]}

     當您使用 this.cfg 存取此設定時，您亦會取得同樣結構的物件.

   - 當 type 為 `choice` 時, 您可以使用 `default` 設定一個字串為預設值, 並用 `values` 屬性指定一個字串陣列; 用戶將能夠選擇陣列中其一值做為此設定的選定值.

   用戶設定的參數可以在任何函式中, 透過 this.cfg[屬性鍵值] 取得. 例如假設我們有如下的 config 設定:

   {
     padding: {name: "間距", type: "number", min: 0, max: 10, default: 1, step: 1},
     unit: {name: "單位", type: "text", default: "人"},
     textColor: {name: "文字顏色", type: "color", default: "#000000"},
     palette: {name: "色盤", type: "palette", default: {colors: ["#f00", "#0f0", "#00f"]}},
     align: {name: "對齊", type: "choice", values: ["left", "center", "right"]}
   }

   那我們的 this.cfg 就會長得如下 ( 此處的範例數值依設定隨機指定 ):

   {padding: 5, unit: "元", textColor: "#f00", palette: {colors: ["#f90", "#0f9", "#09f"]}, align: "left"}

 - dimension: 為一物件, 定義此圖表所接受的資料輸入規格, 於後面詳細說明.
 - init: 初始化函式. 圖表載入時若有任何初始化需求, 可以在這個函式中執行
 - bind: 資料更新函式. 圖表的輸入資料更新時, 可以在這邊做資料整理. 資料、維度與綁定於後面詳細說明.
   - 資料可以透過 this.data 取得
   - 維度定義可透過 this.dimension 取得
   - 資料對應維度的綁定可透過 this.bind 取得
 - resize: 為一函式, 圖表改變尺寸時, 這個函式會被呼叫. 我們的框架會自行在呼叫此函式後接著呼叫 render
 - render: 為一函式, 需要渲染圖表時, 這個函式會被呼叫, 您可以再這裡命令您引用的圖表函式重新繪圖.
 - destroy: 為一函式, 圖表不再被需要時, 這個函式會被呼叫, 您可以再這裡做善後工作.
 - tick: 為一函式, 會不斷被執行, 當您需要做動態圖表時, 可以把需要持續執行的程式部份放在這邊。
   - 實作時，應盡量把成本高的運算 ( 如 DOM 插入 ) 放在 bind / resize / render; 
     tick 則僅做成本低的運算 ( 如更新位置、更新樣式等 )

接著說明資料、維度與綁定.

用戶自行準備的資料有各種可能的規格, 我們會在人機介面處整理成固定的格式再傳入, 但為了能夠整理資料, 我們需要知道這個圖表接受什麼樣的資料, 這點可以透過「維度」來定義. 維度定義為一物件, 內含多個參數, 各參數亦包含一物件, 用來描述該參數接受什麼樣的資料, 參數物件目前僅含一個屬性 `multiple`, `multiple` 為真實代表此參數同時可接收多組資料.

舉例來說, 對"折線圖"我們可以定義維度如下:

    {
      x: {}
      y: {multiple: true}
    }

這樣的維度定義會將用戶資料轉換成一個陣列後存在 this.data 資料成員中, 此陣列中的每一筆資料都是一個物件, 物件中包含對應到各維度的屬性; 當該維度的 multiple 為 false, 則該對應屬性為一個純量如字串或數值; 當該維度的 multiple 為 true 時, 則該對應屬性為一陣列.

例如, 以上面折線圖的維度定義, 一個可能的、僅有兩筆資料的 this.data 或許會如下:

    [{x: 1998, y: [200,300]}, {x: 1999, y: [300,400]}

最後, this.binding 會提供用戶原始資料對維度的綁定資訊, 亦為一物件, 欄位亦逐一對應到維度定義, 亦依 multiple 決定欄位內容是否為陣列; 但其中的定義均為物件, 只有一個 `key` 參數表示原始的欄位名稱. 例如, 依前述的維度定義, 前述的資料可能來自這樣的綁定:

    {
      x: {key: "year"} 
      y: [{key: "profit"}, {key: "revenue"}]
    }


## 使用生成函式準備範例資料

以上是圖表介面模組的程式碼說明, 如何基於現有市面上各別圖表函式庫的規格來生成此程式碼, 或者重頭自行撰寫一個可用的圖表模組, 則是您的工作. 您在生成時, 會試著將您的程式或者特定圖表函式庫接上這個圖表介面模組, 但因為資料是來自用戶, 所以您其中一個重點在於在 `bind` 函式庫中把 this.data 轉換成圖表函式庫可用的形式, 並接著傳給該圖表函式庫供他繪圖; 不過, 在用戶尚未設定資料以前, 我們也想要有一個範例資料供用戶參考圖表可能會有的效果; 您可以使用 `sample` 函式, 傳回包含 `raw` 與 `binding` 的物件, 這裡的 binding 規格如上述一樣, 而raw 亦為一個物件陣列, 代表您假想資料的原始樣貌; 我們的人機介面程式會將您假想資料中各欄位透過 binding 轉換成 `this.data` 再供您利用.

以下為包含範例 sample 函式的一個圖表介面模組片段:

    {
      sample: function() {
        return {
          binding: {
            x: {key: "year"}
            y: [{key: "profit"}, {key: "revenue"}]
          },
          raw: [{year: 1998, profit: 200, revenue: 300}, {year: 1999, profit: 300, revenue: 400}]
        };
      }
    }

sample 傳回的 raw 陣列中, 每個物件的屬性都是純量; 對應到 this.data 時, 屬性可能會因為 multiple 設為 true 而包含陣列, 但這陣列中也只會有純量. 若指定圖表有特殊資料格式的需求, 您必須要在 bind 函式中處理並轉換;若您需要在其它成員函式如 render 中使用轉換完成的資料, 您可以將換好的資料存在 this.parsed, 這樣就可以跨函式使用.

請注意，為了避免圖表預載入時一片空白，請一定要提供一組可用的範例資料。此外更重要的是，不管範例資料或用戶輸入的資料存在與否，您的 `bind` 函式都應該要負責提供一個最小可用的資料，並且在執行時檢查輸入資料若為空時以此最小可用資料替代，以避免程式載入、尚未生成範例資料時發生錯誤。

最糟狀況下，沒有適當的資料就避免執行會用到資料的程式 (如 resize 或 render ) 也是可行的。


## 設定的資料格式

在使用 makechart 透過 this.cfg 提供給您的設定時，有些資料因為其複雜性而將儲存為非純量的結構，例如調色盤:

    {colors: [{ ... }, ... ]


有需要特別注意的類型我們都會在以下段落說明。


### 調色盤

this.cfg 中若有 palette type 的設定, palette.colors 裡的數據可能會是物件, 包含不同解讀方式(HCL, HSL, RGB 等) 的格式.
要注意這並不是 d3.color 可以處理的資料類型，但您可以透過 ldcolor 自行將其轉換成您需要的格式.

ldcolor 可以透過 dependencies 載入:

    dependencies: [
      {name: "ldcolor"},
    ]
    init: function(opt) {
      var ldcolor = opt.ctx.ldcolor;
      ...
    }

要從調色盤取得可用的顏色陣列，可以這樣做:

    list = this.cfg.palette.colors.map(function(v) { return ldcolor.web(v); }); // 轉成網頁可用的格式
    list = this.cfg.palette.colors.map(function(v) { return ldcolor.hex(v); }); // 轉成 hex 表達式


## 其它資訊

了解以上細節後，您應該已經可以正確生成各圖表函式庫的介面模組了; 在此要再提醒您並請您注意, 使用 `pkg.dependencies` 載入函式庫至 `init` 函式的 `opt.ctx` 中時, 要正確的取得該函式庫提供的對口物件或函式; 這點您需要自行翻閱各函式庫提供的說明文件.

為了讓用戶有更多客製空間, 您可以善用我們前面提到的 `mod.config` 成員物件來接收用戶輸入的各種設定如文字、數值與顏色等並用於客製化圖表. 比方說, 若我們請您轉換的圖表支援設定其色塊間的間距, 您可以在 `mod.config` 中加入 `padding` 屬性, 並依前述的規格定義 padding 對應的規格物件. 此外, 由於圖表往往涉及到不定數量的類別, 並因此需要對應到不定數量的顏色, 建議您每次都至少生成一個色盤設定, 並參照用戶提供的色盤值自行內差或擴展色盤以供圖表繪製時所需的顏色使用。

此外, 建議您無論如何都應該至少生成數個設定項, 但不用窮盡所有的可能性; 若我們需要更細緻的設定, 會再請您增添.

您讀完此說明後, 僅需記住此規格, 然後回覆「我清楚了, 請告訴我您想要轉換哪個函式庫」後等待我們的後續輸出即可, 我們會再接著告訴您應該要為哪個函式庫生成此圖表介面模組. 當您輸出模組程式碼時, 請僅輸出程式碼, 可以在程式碼中包含註解但不需要任何其它的前後說明文, 以避免我們的串接程式無法執行您的輸出文字.
