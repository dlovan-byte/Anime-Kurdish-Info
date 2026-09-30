const API="https://api.jikan.moe/v4";
let page=1, lastQuery="", selected=null, episodePage=1;
const $=s=>document.querySelector(s);
const status=(t,live=false)=>{$("#status").textContent=t;$("#dot").parentElement.classList.toggle("live",live)};
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
async function api(path){
 const r=await fetch(API+path);
 if(!r.ok) throw new Error("API "+r.status);
 return r.json();
}
function card(a){
 const img=a.images?.jpg?.large_image_url||a.images?.jpg?.image_url||"";
 const genres=(a.genres||[]).slice(0,2).map(g=>g.name).join(" · ")||"Anime";
 return `<article class="card" onclick="openAnime(${a.mal_id})"><img loading="lazy" src="${img}" alt="${esc(a.title)}"><div class="card-body"><h3>${esc(a.title)}</h3><p>${esc(genres)}</p><span class="badge">★ ${a.score??"—"} · ${a.episodes??"?"} EPS</span></div></article>`;
}
async function search(){
 const q=$("#q").value.trim();
 lastQuery=q; page=1; await loadResults();
}
async function loadResults(){
 $("#results").innerHTML="<p style='color:#777'>Loading anime…</p>";
 status("Loading…");
 try{
  const params=new URLSearchParams({page,limit:20,order_by:$("#sort").value,sort:"desc"});
  if(lastQuery)params.set("q",lastQuery);
  if($("#type").value)params.set("type",$("#type").value);
  const data=await api("/anime?"+params);
  $("#results").innerHTML=data.data.length?data.data.map(card).join(""):"<p style='color:#777'>No anime found.</p>";
  $("#page").textContent="Page "+page;
  status("Live API connected",true);
 }catch(e){$("#results").innerHTML="<p style='color:#b77'>Could not reach the anime API. Check your internet connection and try again.</p>";status("Connection error")}
}
async function openAnime(id){
 $("#detail").classList.remove("hidden");document.querySelectorAll("[data-detail-section]").forEach(x=>x.classList.remove("hidden"));
 $("#title").textContent="Loading…";location.hash="detail";
 try{
  const [a,c] = await Promise.all([api(`/anime/${id}/full`),api(`/anime/${id}/characters`)]);
  selected=a.data;
  const d=a.data;
  $("#poster").src=d.images?.jpg?.large_image_url||"";
  $("#poster").alt=d.title;
  $("#title").textContent=d.title;
  $("#meta").textContent=[d.type,d.year,d.studios?.map(x=>x.name).join(", ")].filter(Boolean).join("  /  ");
  $("#score").textContent=d.score??"—";$("#synopsis").textContent=d.synopsis||"No synopsis available.";
  $("#eps").textContent=d.episodes??"—";$("#status2").textContent=d.status||"—";
  $("#aired").textContent=d.aired?.string||"—";
  $("#chips").innerHTML=(d.genres||[]).map(g=>`<span>${esc(g.name)}</span>`).join("");
  $("#chars").innerHTML=(c.data||[]).slice(0,10).map(x=>`<article class="character"><img loading="lazy" src="${x.character?.images?.jpg?.image_url||""}" alt="${esc(x.character?.name)}"><div><h3>${esc(x.character?.name)}</h3><p>${esc(x.role||"Character")}</p></div></article>`).join("");
  episodePage=1; await loadEpisodes(id);
  $("#detail").scrollIntoView({behavior:"smooth"});
 }catch(e){$("#synopsis").textContent="Could not load this anime profile right now."}
}
async function loadEpisodes(id,append=false){
 try{
  const d=await api(`/anime/${id}/episodes?page=${episodePage}`);
  const html=(d.data||[]).map(e=>`<div class="ep"><b>${String(e.mal_id).padStart(2,"0")}</b><span>${esc(e.title||"Untitled")}</span><small>${e.filler?"Filler":e.recap?"Recap":e.aired?new Date(e.aired).toLocaleDateString():""}</small></div>`).join("");
  $("#episodesList").innerHTML=append?$("#episodesList").innerHTML+html:html;
  $("#moreEpisodes").style.display=d.pagination?.has_next_page?"block":"none";
 }catch(e){$("#episodesList").innerHTML="<p style='color:#777'>Episode data unavailable.</p>"}
}
$("#search").onclick=search;$("#q").addEventListener("keydown",e=>{if(e.key==="Enter")search()});
$("#type").onchange=()=>{page=1;loadResults()};$("#sort").onchange=()=>{page=1;loadResults()};
$("#prev").onclick=()=>{if(page>1){page--;loadResults()}};$("#next").onclick=()=>{page++;loadResults()};
$("#moreEpisodes").onclick=async()=>{if(selected){episodePage++;await loadEpisodes(selected.mal_id,true)}};
$("#random").onclick=async()=>{try{const d=await api("/random/anime");openAnime(d.data.mal_id)}catch(e){}};
$(".menu").onclick=()=>document.querySelector(".nav nav").classList.toggle("open");
$("#lang").onclick=()=>{document.documentElement.dir=document.documentElement.dir==="rtl"?"ltr":"rtl";$("#lang").textContent=$("#lang").textContent==="EN"?"AR":"EN"};
status("Connecting…");loadResults();
