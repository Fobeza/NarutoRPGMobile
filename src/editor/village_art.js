// Совместимый интерфейс укреплений; все пять рисунков теперь сгенерированы.
G.villageArt={ids:['vwall_h','vwall_v','vwall_corner','vwall_end','vgate'],
 sprite(id){return this.ids.includes(id)?G.editorArt.sprite(id):null;}};
