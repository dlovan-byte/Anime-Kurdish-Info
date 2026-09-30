(() => {
  "use strict";

  const JIKAN = "https://api.jikan.moe/v4";
  const KITSU = "https://kitsu.io/api/edge";
  const REQUEST_TIMEOUT = 12000;
  let page = 1, currentQuery = "Attack on Titan", currentData = [], currentTotal = 0, currentSource = "";
  let lang = localStorage.getItem("animeLang") || "en";

  const $ = id => document.getElementById(id);
  const els = {
    form:$("searchForm"), input:$("searchInput"), type:$("typeFilter"), score:$("scoreFilter"), sort:$("sortFilter"),
    random:$("randomBtn"), grid:$("grid"), msg:$("message"), loading:$("loading"), status:$("statusText"),
    dot:$("statusDot"), prev:$("prevBtn"), next:$("nextBtn"), page:$("pageText"), count:$("countText"),
    dialog:$("detailDialog"), detail:$("detailContent"), close:$("closeDialog"), lang:$("langBtn")
  };

  const translations = {
    en:{eyebrow:"01 / LIVE SEARCH",title:"Anime Library",subtitle:"Search a live anime database, explore scores, studios, characters and episodes.",connecting:"Connecting to anime database…",searchPlaceholder:"Search anime…",search:"SEARCH",anyType:"Any type",anyScore:"Any score",relevance:"Relevance",highestScore:"Highest score",newest:"Newest",titleAZ:"Title A–Z",random:"RANDOM",resultsLabel:"02 / RESULTS",discover:"Discover anime",previous:"← PREVIOUS",next:"NEXT →",footer:"Live data via Jikan (MyAnimeList) with Kitsu fallback. Unofficial APIs.",loading:"Loading anime…",connection:"Anime API connection failed. The site is online, but the live providers did not answer. Tap SEARCH to retry.",noResults:"No anime found.",details:"Anime details",synopsis:"Synopsis",characters:"Characters",type:"Type",episodes:"Episodes",status:"Status",score:"Score",year:"Year",studios:"Studios",genres:"Genres",mal:"MyAnimeList",source:"Data source",close:"Close"},
    ku:{eyebrow:"٠١ / گەڕانی ڕاستەوخۆ",title:"کتێبخانەی ئەنیمە",subtitle:"لە بنکەدراوەی زیندووی ئەنیمە بگەڕێ، نمرە و ستۆدیو و کارەکتەر و ئەڵقەکان ببینە.",connecting:"پەیوەندی بە بنکەدراوەی ئەنیمە…",searchPlaceholder:"گەڕان بەدوای ئەنیمە…",search:"گەڕان",anyType:"هەر جۆرێک",anyScore:"هەر نمرەیەک",relevance:"پەیوەندیدار",highestScore:"بەرزترین نمرە",newest:"نوێترین",titleAZ:"ناونیشان A–Z",random:"هەڕەمەکی",resultsLabel:"٠٢ / ئەنجامەکان",discover:"ئەنیمە بدۆزەرەوە",previous:"← پێشوو",next:"دواتر →",footer:"داتاکان لە Jikan (MyAnimeList) و Kitsu وەردەگیرێن. API ـەکان نافەرمیین.",loading:"ئەنیمەکان بار دەکرێن…",connection:"پەیوەندی بە API سەرکەوتوو نەبوو. ماڵپەڕەکە کار دەکات، بەڵام خزمەتگوزارییەکانی داتا وەڵامیان نەدا. دووبارە گەڕان بکە.",noResults:"هیچ ئەنیمەیەک نەدۆزرایەوە.",details:"وردەکارییەکانی ئەنیمە",synopsis:"پوختە",characters:"کارەکتەرەکان",type:"جۆر",episodes:"ئەڵقەکان",status:"دۆخ",score:"نمرە",year:"ساڵ",studios:"ستۆدیوەکان",genres:"جۆرەکان",mal:"MyAnimeList",source:"سەرچاوەی داتا",close:"داخستن"}
  };

  function t(k){ return translations[lang][k] || k; }

  function setLang(next){
    lang = next; localStorage.setItem("animeLang",lang);
    document.documentElement.lang = lang === "ku" ? "ku" : "en";
    document.documentElement.dir = lang === "ku" ? "rtl" : "ltr";
    document.body.classList.toggle("rtl",lang==="ku");
    document.querySelectorAll("[data-i18n]").forEach(e => e.textContent=t(e.dataset.i18n));
    document.querySelectorAll("[data-i18n-placeholder]").forEach(e => e.placeholder=t(e.dataset.i18nPlaceholder));
    els.lang.textContent = lang === "ku" ? "EN" : "کوردی";
    els.page.textContent = lang==="ku" ? `پەڕەی ${page}` : `Page ${page}`;
  }

  function showMessage(text){ els.msg.textContent=text; els.msg.classList.remove("hidden"); }
  function clearMessage(){ els.msg.classList.add("hidden"); }
  function loading(on){ els.loading.classList.toggle("hidden",!on); }
  function status(ok, text){ els.dot.className="status-dot "+(ok?"ok":"bad"); els.status.textContent=text; }

  async function fetchJSON(url){
    const ctrl = new AbortController();
    const timer = setTimeout(()=>ctrl.abort(),REQUEST_TIMEOUT);
    try{
      const r = await fetch(url,{signal:ctrl.signal,headers:{Accept:"application/json"}});
      if(!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } finally { clearTimeout(timer); }
  }

  async function jikanSearch(){
    const p = new URLSearchParams({page:String(page),limit:"20"});
    if(currentQuery) p.set("q",currentQuery);
    if(els.type.value) p.set("type",els.type.value);
    if(Number(els.score.value)>0) p.set("min_score",els.score.value);
    const data = await fetchJSON(`${JIKAN}/anime?${p}`);
    currentSource="Jikan";
    return {items:data.data||[], pagination:data.pagination||{}};
  }

  async function kitsuSearch(){
    const p = new URLSearchParams({"page[limit]":"20","page[offset]":String((page-1)*20)});
    if(currentQuery) p.set("filter[text]",currentQuery);
    if(els.type.value) p.set("filter[subtype]",els.type.value);
    const data = await fetchJSON(`${KITSU}/anime?${p}`);
    currentSource="Kitsu";
    const items=(data.data||[]).map(x=>{
      const a=x.attributes||{}, t=a.titles||{};
      return {
        mal_id:`kitsu-${x.id}`, title:t.en||t.en_jp||t.ja_jp||"Untitled", title_japanese:t.ja_jp||"",
        type:(a.subtype||"").toUpperCase(), episodes:a.episodeCount, score:a.averageRating?Number(a.averageRating)/10:null,
        year:a.startDate?Number(String(a.startDate).slice(0,4)):null,
        synopsis:a.synopsis||"", images:{jpg:{image_url:a.posterImage?.medium||a.posterImage?.small||a.posterImage?.original}},
        genres:(a.genres||[]).map(g=>({name:g.attributes?.name||""})), studios:[],
        url:`https://kitsu.io/anime/${x.id}`, _kitsuId:x.id
      };
    });
    return {items,pagination:{last_visible_page:Math.max(1,Math.ceil((data.meta?.count||items.length)/20)),has_next_page:!!data.links?.next,total:data.meta?.count||items.length}};
  }

  async function search(){
    currentQuery=els.input.value.trim();
    clearMessage(); loading(true); els.grid.innerHTML="";
    status(false,t("loading"));
    try{
      let result;
      try{ result=await jikanSearch(); }
      catch(e){ result=await kitsuSearch(); }
      currentData=result.items||[];
      currentTotal=result.pagination?.total||currentData.length;
      applySort();
      render();
      status(true,`${currentSource} • ${currentData.length} results`);
    }catch(e){
      currentData=[]; render();
      status(false,"Connection error");
      showMessage(t("connection"));
    }finally{ loading(false); }
  }

  function applySort(){
    const s=els.sort.value;
    if(s==="score_desc") currentData.sort((a,b)=>(b.score||0)-(a.score||0));
    if(s==="year_desc") currentData.sort((a,b)=>(b.year||0)-(a.year||0));
    if(s==="title_asc") currentData.sort((a,b)=>(a.title||"").localeCompare(b.title||""));
  }

  function imgOf(a){
    return a.images?.jpg?.large_image_url || a.images?.jpg?.image_url || a.images?.webp?.large_image_url || a.images?.webp?.image_url || "";
  }
  function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}

  function render(){
    els.grid.innerHTML="";
    els.count.textContent=currentTotal?`${currentTotal.toLocaleString()}+`:"";
    els.page.textContent=lang==="ku"?`پەڕەی ${page}`:`Page ${page}`;
    els.prev.disabled=page<=1;
    els.next.disabled=currentData.length<20 && page>1;
    if(!currentData.length){ showMessage(t("noResults")); return; }
    clearMessage();
    currentData.forEach((a,i)=>{
      const card=document.createElement("article"); card.className="card"; card.tabIndex=0;
      const genres=(a.genres||[]).slice(0,2).map(g=>`<span class="tag">${esc(g.name)}</span>`).join("");
      card.innerHTML=`<div class="poster">${imgOf(a)?`<img loading="lazy" src="${esc(imgOf(a))}" alt="">`:""}${a.score?`<span class="score">★ ${Number(a.score).toFixed(1)}</span>`:""}</div>
      <div class="card-body"><div class="card-title">${esc(a.title)}</div><div class="meta">${esc(a.type||"—")} · ${esc(a.episodes??"—")} eps · ${esc(a.year||"—")}</div><div class="genres">${genres}</div></div>`;
      card.onclick=()=>openDetails(a);
      card.onkeydown=e=>{if(e.key==="Enter")openDetails(a)};
      els.grid.appendChild(card);
    });
  }

  async function openDetails(a){
    els.detail.innerHTML=`<div class="loading"><span></span><span></span><span></span></div>`;
    els.dialog.showModal();
    let d=a;
    if(a.mal_id && !String(a.mal_id).startsWith("kitsu-")){
      try{
        const r=await fetchJSON(`${JIKAN}/anime/${a.mal_id}/full`);
        d=r.data||a;
      }catch(e){}
    } else if(a._kitsuId){
      try{
        const r=await fetchJSON(`${KITSU}/anime/${a._kitsuId}`);
        const x=r.data||{}, at=x.attributes||{};
        d={...a,synopsis:at.synopsis||a.synopsis,episodes:at.episodeCount??a.episodes,score:at.averageRating?Number(at.averageRating)/10:a.score,status:at.status||"",year:at.startDate?String(at.startDate).slice(0,4):a.year};
      }catch(e){}
    }
    const genres=(d.genres||[]).map(g=>`<span class="tag">${esc(g.name)}</span>`).join("");
    const studios=(d.studios||[]).map(s=>s.name).join(", ")||"—";
    els.detail.innerHTML=`<div class="detail">
      <img src="${esc(imgOf(d))}" alt="">
      <div><div class="eyebrow">${esc(d.type||"ANIME")}</div><h2>${esc(d.title)}</h2>
      <p class="synopsis">${esc(d.synopsis||"No synopsis available.")}</p>
      <div class="facts">
        <div class="fact"><small>${t("score")}</small><strong>${d.score?Number(d.score).toFixed(1):"—"}</strong></div>
        <div class="fact"><small>${t("episodes")}</small><strong>${d.episodes??"—"}</strong></div>
        <div class="fact"><small>${t("year")}</small><strong>${d.year||d.aired?.prop?.from?.slice?.(0,4)||"—"}</strong></div>
        <div class="fact"><small>${t("status")}</small><strong>${esc(d.status||"—")}</strong></div>
        <div class="fact"><small>${t("studios")}</small><strong>${esc(studios)}</strong></div>
        <div class="fact"><small>${t("source")}</small><strong>${String(d.mal_id||"").startsWith("kitsu-")?"Kitsu":"Jikan"}</strong></div>
      </div>
      <div class="genres">${genres}</div>
      <div class="detail-links" style="margin-top:18px">${d.url?`<a href="${esc(d.url)}" target="_blank" rel="noopener">${t("mal")}</a>`:""}</div>
      </div></div>`;
  }

  els.form.addEventListener("submit",e=>{e.preventDefault();page=1;search();});
  els.type.addEventListener("change",()=>{page=1;search();});
  els.score.addEventListener("change",()=>{page=1;search();});
  els.sort.addEventListener("change",()=>{applySort();render();});
  els.prev.addEventListener("click",()=>{if(page>1){page--;search();window.scrollTo({top:0,behavior:"smooth"});}});
  els.next.addEventListener("click",()=>{page++;search();window.scrollTo({top:0,behavior:"smooth"});});
  els.random.addEventListener("click",async()=>{
    clearMessage();loading(true);status(false,t("loading"));
    try{
      let a;
      try{const r=await fetchJSON(`${JIKAN}/random/anime`);a=r.data;currentSource="Jikan";}
      catch(e){const r=await fetchJSON(`${KITSU}/anime?page[limit]=20&sort=-averageRating`);const arr=r.data||[];a=arr[Math.floor(Math.random()*arr.length)];if(a){const at=a.attributes||{},tt=at.titles||{};a={mal_id:`kitsu-${a.id}`,_kitsuId:a.id,title:tt.en||tt.en_jp||tt.ja_jp||"Untitled",images:{jpg:{image_url:at.posterImage?.medium}},score:at.averageRating?Number(at.averageRating)/10:null,synopsis:at.synopsis||"",type:(at.subtype||"").toUpperCase(),episodes:at.episodeCount};}currentSource="Kitsu";}
      if(a){await openDetails(a);status(true,`${currentSource}`);}
    }catch(e){showMessage(t("connection"));status(false,"Connection error");}
    finally{loading(false);}
  });
  els.close.addEventListener("click",()=>els.dialog.close());
  els.dialog.addEventListener("click",e=>{if(e.target===els.dialog)els.dialog.close();});
  els.lang.addEventListener("click",()=>setLang(lang==="en"?"ku":"en"));

  setLang(lang);
  search();
})();