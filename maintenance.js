require([
  "esri/portal/Portal",
  "esri/identity/OAuthInfo",
  "esri/identity/IdentityManager",
  "esri/WebMap", 
  "esri/views/MapView", 
  "esri/layers/FeatureLayer",
  "esri/geometry/Point",
  "esri/geometry/Circle",
  "esri/Graphic",
  "esri/geometry/geometryEngine",
  "esri/core/watchUtils",
  "esri/widgets/Home",
  "esri/widgets/Search",
  "esri/widgets/Expand",
  "esri/widgets/Legend",
  "esri/widgets/BasemapGallery"]
        , function(Portal, OAuthInfo, IdentityManager, WebMap, MapView, FeatureLayer, Point, Circle, Graphic, geometryEngine, watchUtils, Home, Search, Expand, Legend, BasemapGallery) {

  var application_id = "MCubDzQZqCpjC3Ca";
  var token = "";
  
  var portalUrl =  "https://www.arcgis.com/sharing";
  var info = new OAuthInfo({
    appId: application_id,
    popup: false
  });
  IdentityManager.registerOAuthInfos([info]);
  IdentityManager.getCredential(portalUrl);
  
  var portal = new Portal();
  portal.load().then(function () {
    portal.user.fetchGroups().then(function(fetchItemResult){
      token = IdentityManager.credentials[0].token;
    });
  });
  
  var centermarkerSymbol = {
    type: "simple-marker",
    color: [226, 0, 230],
    outline: {
      color: [255, 255, 255],
      width: 2
    }
  };

  var buffermarkerSymbol = {
    type: "simple-fill",
    color: [140, 140, 222, 0.3],
    outline: {
      color: [0, 0, 0, 0.2],
      width: 0
    }
  };
  
  var selectmarkerSymbol = {
    type: "simple-marker",
    color: [0, 0, 0, 0],
    outline: {
      color: [0, 255, 0],
      width: 2
    }
  };

  const main_map = new WebMap({
    portalItem:{
      id: "85f8756ee7bf48dc8387325bc1b0b8bf"
    }
  });
  
  const child_map = new WebMap({
    portalItem:{
      id: "350be56fd25e4078bcdb34b2c2b7a3c8"
    }
  });

  var current_centerPoint = null;
  
  const main_mapview = new MapView({
    container: "sceneDiv",
    map: main_map,
    popup: {
      dockEnabled: true,
      dockOptions: {
        buttonEnabled: false,
        breakpoint: true,
        position: "Top Left"
      }
    }
  });
  
  const child_mapview = new MapView({
    container: "childsceneDiv",
    map: child_map,
    popup: {
      dockEnabled: true,
      dockOptions: {
        buttonEnabled: false,
        breakpoint: true,
        position: "Top Left"
      }
    }
  });
  
  let homeWidget = new Home({
    view: main_mapview
  });
  main_mapview.ui.add(homeWidget, "top-left");
  
  let searchWidget = new Search({
    view: main_mapview
  });
  
  main_mapview.ui.add(searchWidget, {
    position: "top-left",
    index: 0
  });

  let legendWidget = new Legend({
    view: main_mapview
  });

  let leExpand = new Expand({
    view: main_mapview,
    content: legendWidget,
    expandTooltip: "凡例",
    expanded: true
  });
  main_mapview.ui.add(leExpand, {
    position: "bottom-left",
    index: 0
  });

  let basemapGallery = new BasemapGallery({
    view: main_mapview
  });
  let bgExpand = new Expand({
    view: main_mapview,
    content: basemapGallery,
    expandTooltip: "背景地図"
  });
  main_mapview.ui.add(bgExpand, {
    position: "top-left"
  });

  var poleLayer = null;
  var socialTowerLayer = null;
  var requestLayer = null;
  var responseLayer = null;
  var inferenceLayer = null;
  var inferenceChildLayer = null;
  var orderResLayer = null;
  
  main_map.when(function (layers) {
    //レイヤー取得
    poleLayer = layers.allLayers.find(
      value => value.title == "電柱");
    socialTowerLayer = layers.allLayers.find(
      value => value.title == "高圧送電線");
    requestLayer = layers.allLayers.find(
      value => value.title == "端末指示");
    responseLayer = layers.allLayers.find(
      value => value.title == "受信データ");
    inferenceLayer = layers.allLayers.find(
      value => value.title == "推論受信データ");
    orderResLayer = layers.allLayers.find(
      value => value.title == "指示受信データ");
    
    reset_form(1); 
    
    main_mapview.whenLayerView(poleLayer).then((layerView) => {
      var highlightSelect;
      
      $('body').on('click', '#t1_instruction_list li', async function(e){
        if (highlightSelect) {
          highlightSelect.remove();
        }
        main_mapview.graphics.removeAll();

        const listNode = document.getElementById("t1_instruction_detail_list");
        const fragment = document.createDocumentFragment();
        
        var no = Number(e.currentTarget.dataset.orderno);
        var where = "orderNo=" + no;
        var features = await getOrderDetailList(where);
        
        for (var i = 0; i< features.length; i++) {
          const attributes = features[i].attributes;
          const oid = attributes["OBJECTID"];
          const geo = features[i].geometry;
          const instruction = attributes["instruction"];
          const expirykubun = attributes["expirykubun"];
          const expirydate = attributes["expirydate"];
          const teaminal_id = attributes["teaminal_id"];
          const bikou = attributes["bikou"];

          let selectGraphic = new Graphic({
            geometry: geo,
            symbol: selectmarkerSymbol
          });
          main_mapview.graphics.add(selectGraphic);

          const li = document.createElement("li");
          li.classList.add("panel-result");
          li.tabIndex = 0;
          li.setAttribute("data-oid", oid);

          var content = "";
          content += instruction + "\t" + bikou;
          li.textContent = content;
          fragment.appendChild(li);
        }

        listNode.innerHTML = "";
        listNode.appendChild(fragment);
        
        var zoom_level = main_mapview.zoom;
        if (zoom_level < 17) {
          zoom_level = 17;
        }

        setTimeout(function(){
          main_mapview.graphics.removeAll();
        }, 2000);

        /*
        main_mapview.goTo(
          {
            target: main_mapview.graphics.items
          }
        ).catch((error) => {
          console.error(error);
        });
        */
      });

      //範囲抽出リスト選択時
      $('body').on('click', '#t2_facility_list li', function(e){
        if (highlightSelect) {
          highlightSelect.remove();
        }

        var oid = Number(e.currentTarget.dataset.oid);
        var geo = new Point(JSON.parse(e.currentTarget.dataset.geometry));
        highlightSelect = layerView.highlight(oid);
        
        var zoom_level = main_mapview.zoom;
        if (zoom_level < 17) {
          zoom_level = 17;
        }
        
        main_mapview.goTo(
          {
            target: geo,
            zoom: zoom_level
          }
        ).catch((error) => {
          console.error(error);
        });
      });
    });
  });
  
  //推論子マップの表示ボタンを追加
  main_mapview.when(function () {
    inferenceLayer.on("layerview-create", function(event){
      const responseThisAction = {
        title: "詳細情報",
        id: "response-this",
        className: "esri-icon-notice-round"
      };
      inferenceLayer.popupTemplate.actions = [responseThisAction];
    });
  });

  child_map.when(function (layers) {
    inferenceChildLayer = layers.allLayers.find(
      value => value.title == "推論受信子データ");
    inferenceChildLayer.definitionExpression = "1<>1";
  });
  
  main_mapview.popup.on("trigger-action", (e) => {
    if (e.action.id === "response-this") {
      var key_code = main_mapview.popup.features[0].attributes.key_code;
      inferenceChildLayer.definitionExpression = "key_code = '" + key_code + "'";
      $('#childscenForm').show();
      inferenceChildLayer.queryExtent().then(function(results){
        child_mapview.goTo(results.extent);
      });
    }
  });
  
  watchUtils.whenTrue(main_mapview.popup,'visible', function(){
    
    if (inferenceChildLayer == null){
      return;
    }
    watchUtils.whenFalseOnce(main_mapview.popup,'visible',function(){
      inferenceChildLayer.definitionExpression = "1<>1";
      $('#childscenForm').hide();
    })
  });
  
  //指定されたポイントにグラフィックを表示
  function drawCenterGraphic(point) {
    main_mapview.graphics.removeAll();
    
    var pointGraphic = new Graphic({
      geometry: point, 
      symbol: centermarkerSymbol
    });
    main_mapview.graphics.add(pointGraphic);
    
    //$('#submitDiv').show();
  }
  
  //指令を抽出して表示
  async function query_intrfeatures() {

    var results = await getOrderList();
    
    const objectCount = document.getElementById('t1_instruction_count');
    objectCount.innerText = results.length + "件";
    
    const listNode = document.getElementById("t1_instruction_list");
    listNode.innerHTML = "";
    
    const fragment = document.createDocumentFragment();

    for (var i = 0; i< results.length; i++) {
      const orderNo = results[i]["orderNo"];
      const count = results[i]["count"];
      const instruction = results[i]["instruction"];
      const expirykubun = results[i]["expirykubun"];
      const expirydate = results[i]["expirydate"];
      const teaminal_id = results[i]["teaminal_id"];

      const input = document.createElement("input");
      input.type = "radio";
      input.name = "fruit";
      input.id = "radio_" + orderNo; 
      
      fragment.appendChild(input);
      
      const li = document.createElement("li");
      li.classList.add("panel-result");
      li.tabIndex = 0;
      li.setAttribute("data-orderno", orderNo);
      li.setAttribute("data-count", count);
      
      const label_fragment = document.createDocumentFragment();
      const label = document.createElement("label");
      label.for = "radio_" + orderNo;
      var content = "";
      content += "指令No.\t" + orderNo + "\t";
      content += instruction + "\n";
      content += expirykubun + "\t件数\t" + count;
      label.textContent = content;
      label_fragment.appendChild(label);
      //li.textContent = content;
      
      li.appendChild(label_fragment);
      
      fragment.appendChild(li);
    }

    //listNode.innerHTML = "";
    listNode.appendChild(fragment);
  }
  
  //指定された半径の設備を抽出して表示
  async function query_bufferfeatures(point) {
    main_mapview.graphics.removeAll();
    
    var pointGraphic = new Graphic({
      geometry: point, 
      symbol: centermarkerSymbol
    });
    main_mapview.graphics.add(pointGraphic);
    
    const radius = document.getElementById('t2_radius-slider');

    var buffer = geometryEngine.geodesicBuffer(point, radius.value, "meters");
    var bufferGraphic = new Graphic({
      geometry: buffer,
      symbol: buffermarkerSymbol
    });
    main_mapview.graphics.add(bufferGraphic);

    var query = poleLayer.createQuery();
    query.where = "1=1";
    query.geometry = buffer;
    query.spatialRelationship = "intersects";
    query.returnGeometry = true;
    query.outFields = "*";
    
    var result = await poleLayer.queryFeatures(query);
    var features = result.features;

    const objectCount = document.getElementById('t2_facility_count');
    objectCount.innerText = features.length + "件　選択中";
    
    const listNode = document.getElementById("t2_facility_list");
    const fragment = document.createDocumentFragment();

    for (var i = 0; i< features.length; i++) {
      const attributes = features[i].attributes;
      const oid = attributes["OBJECTID"];
      const geo = features[i].geometry;
      const name = attributes["SorcialPole"];

      const li = document.createElement("li");
      li.classList.add("panel-result");
      li.tabIndex = 0;
      li.setAttribute("data-oid", oid);
      li.setAttribute("data-geometry", JSON.stringify(geo));
      li.setAttribute("data-name", name);
      li.textContent = name;

      fragment.appendChild(li);

      let selectGraphic = new Graphic({
        geometry: geo,
        symbol: selectmarkerSymbol
      });

      main_mapview.graphics.add(selectGraphic);
    }

    listNode.innerHTML = "";
    listNode.appendChild(fragment);

    /*
    if (features.length > 0){
      $('#submitDiv').show();
    } else {
      $('#submitDiv').hide();
    }
    */
  }
  
  //タブ切り替え
  $(".tab-switch").on("click", function(event){
    var id = event.target.id;
    if (id == "tab01") {
      reset_form(1);
    } else if (id == "tab02") {
      reset_form(2);
    } else if (id == "tab03") {
      reset_form(3);
    }
  });
  
  //マップクリック時
  main_mapview.on("click", function(event){
    const selectTab = $('input:radio[class="tab-switch"]:checked')[0].id;
    var t2_instructionselect = document.getElementById('t2_instructionselect').value;
    
    if (selectTab == "tab02") {
      var point = event.mapPoint;
      current_centerPoint = point;
      
      if (t2_instructionselect == "通常") {
        drawCenterGraphic(point);
      } else if (t2_instructionselect == "電柱範囲") {
        query_bufferfeatures(point);
      }
    }
  });
  
  //指令確認タブ　指示内容変更時
  $('#t1_instruction').on("change", function(event){
    query_intrfeatures();
  });
  
  //指令確認タブ　いつまで変更時
  $('#t1_expirykubun').on("change", function(event){
    query_intrfeatures();
  });
  
  //指令確認タブ　オーダー期限変更時
  $('#t1_datetimeselect').on("change", function(event){
    query_intrfeatures();
  });
  
  //指令確認タブ　端末ID変更時
  $('#t1_teaminal_id').on("change", function(event){
    query_intrfeatures();
  });
  
  //指令登録タブ　指示方法変更
  $('#t2_instructionselect').on("change", function(event){
    var t2_instructionselect = document.getElementById('t2_instructionselect').value;
    if (t2_instructionselect == "通常") {
      $('#t2_bufferselectDiv').hide();
    } else if (t2_instructionselect == "電柱範囲") {
      $('#t2_bufferselectDiv').show();
    } else {
      $('#t2_bufferselectDiv').hide();
    }
    
    reset_form(2);
  });
  
  //指令登録タブ　クリアボタンクリック時
  $('#t2_clear').on("click", function(event){
    reset_form(2);
  });

  //指令登録タブ　半径の指定変更
  $('#t2_radius-slider').on("change", function(event){
    document.getElementById('t2_radius-value').innerText = event.target.value;
    
    if (current_centerPoint != null) {
      query_bufferfeatures(current_centerPoint);
    }
  });
  
  //指令登録タブ　オーダー期限変更時
  $('#t2_expiryselect').on("change", function(event){
    var t2_expiryselect = document.getElementById('t2_expiryselect').value;
    
    document.getElementById('t2_expirydate').style.visibility ="hidden";
    if (t2_expiryselect == "1日後") {
      document.getElementById('t2_expirydate').value = getAddDate(1);
    } else if (t2_expiryselect == "1週間後") {
      document.getElementById('t2_expirydate').value = getAddDate(7);
    } else if (t2_expiryselect == "1ヶ月後") {
      document.getElementById('t2_expirydate').value = getAddDate(30);
    } else if (t2_expiryselect == "カスタム") {
      document.getElementById('t2_expirydate').value = getAddDate(1);
      document.getElementById('t2_expirydate').style.visibility ="visible";
    }
  });

  //指令登録タブ　指示登録ボタンクリック
  $('#t2_submit').on("click", async function(event){
    
    if (current_centerPoint == null) {
      alert("地点を選択してください");
      return;
    }
    var features = await createAddFeatures();
    add_feature(features);
  });
  
  //結果確認タブ　日付変更時
  $('#t3_datetimeselect').on("change", function(event){
    filterResponseLayer();
  });
  
  //結果確認タブ　選択条件変更時
  $('#t3_filterselect').on("change", function(event){
    var t3_filterselect = document.getElementById('t3_filterselect').value;
    if (t3_filterselect == "属性条件") {
      $('#t3_spatialFilterDiv').hide();
    } else if (t3_filterselect == "空間条件") {
      $('#t3_spatialFilterDiv').show();
    } else {
      $('#t3_spatialFilterDiv').hide();
    }
    filterResponseLayer();
  });
  
  //結果確認タブ　レイヤー選択変更時
  $('#t3_selectLayer').on("change", function(event){
    filterResponseLayer();
  });
  
  //結果確認タブ　半径変更時
  $('#t3_radius-slider').on("change", function(event){
    document.getElementById('t3_radius-value').innerText = event.target.value;
    
    filterResponseLayer();
  });
  
  //結果レイヤーのフィルター処理
  async function filterResponseLayer() {
    main_mapview.graphics.removeAll();

    var filterselect = document.getElementById('t3_filterselect').value;
    var selectLayer = document.getElementById('t3_selectLayer').value;
    var radius = document.getElementById('t3_radius-slider').value;
    if (filterselect == "空間条件") {
      var geometrys = await getFacilityGeometry(selectLayer);
      drawGraphicSpatialBuffer(geometrys, radius);
    }

    var oids = await getResponseOids("推論");
    
    if (oids.length > 0) {
      inferenceLayer.definitionExpression = "OBJECTID IN (" + oids.join(',') + ")";
    } else {
      inferenceLayer.definitionExpression = "1<>1";
    }
    
    oids = await getResponseOids("指示");
    
    if (oids.length > 0) {
      orderResLayer.definitionExpression = "OBJECTID IN (" + oids.join(',') + ")";
    } else {
      orderResLayer.definitionExpression = "1<>1";
    }
  }
  
  //AddFeatures JSONの作成
  async function createAddFeatures() {
    var features = [];
    
    var t2_instructionselect = document.getElementById('t2_instructionselect').value;
    var instruction = document.getElementById('t2_instruction').value;
    var expirykubun = document.getElementById('t2_expirykubun').value;
    var expirydate = document.getElementById('t2_expirydate').value;
    
    if (expirydate == "") {
      expirydate = null
    } else {
      expirydate = expirydate.replace(/-/g, '/') + " 00:00:00";
    }
    
    var teaminal_id = document.getElementById('t2_teaminal_id').value;
    var orderNo = await getNewOrderNo();
    var orderCode = orderNo + " " + formaDate(new Date());
    
    var base_json = {
      "geometry": {
        "x": current_centerPoint.longitude,
        "y": current_centerPoint.latitude,
        "spatialReference" : {"wkid" : 4326}
      },
      "attributes": {
        "longitude": current_centerPoint.longitude,
        "latitude": current_centerPoint.latitude,
        "instruction": instruction,
        "expirykubun": expirykubun,
        "expirydate": expirydate,
        "orderNo": orderNo,
        "orderCode": orderCode,
        "teaminal_id": teaminal_id,
        "bikou": ""
      }
    };
    
    if (t2_instructionselect == "通常") {
      features.push(base_json);
    } else if (t2_instructionselect == "電柱範囲") {
      var polelist = document.getElementById('t2_facility_list').children;

      for (var i = 0; i< polelist.length; i++) {
        var oid = polelist[i].dataset.oid;
        var geo = new Point(JSON.parse(polelist[i].dataset.geometry));
        var name = polelist[i].dataset.name;

        var feature = JSON.parse(JSON.stringify(base_json));
        feature.geometry.x = geo.longitude;
        feature.geometry.y = geo.latitude;
        feature.attributes.longitude = geo.longitude;
        feature.attributes.latitude = geo.latitude;
        features.push(feature);
      }
    }
    return features;
  }
  
  //指令登録処理
  function add_feature(features) {
    var url = requestLayer.url + "/" + requestLayer.layerId + "/addFeatures";

    var form = new FormData();
    form.set('f','json');
    form.set('features', JSON.stringify(features));
    form.set('token', token);

    $.ajax({
      url: url,
      type: "POST",
      data: form,
      processData: false,
      contentType: false,
      dataType: 'json',
      async: false
    }).done(function(data) {
      console.log(data);
      reset_form(1);
      alert("指示が登録されました");
    }).fail(function(data) {
      console.log(data);
      alert("指示の登録が失敗しました");
    });
  }
  
  //指令番号ごとのデータを取得
  async function getOrderList() {
    
    var instruction = document.getElementById('t1_instruction').value;
    var expirykubun = document.getElementById('t1_expirykubun').value;
    var expirydate = document.getElementById('t1_datetimeselect').value;
    var teaminal_id = document.getElementById('t1_teaminal_id').value;
    
    var where = "1=1";
    if (instruction != "すべて"){
      where += " and instruction = '" + instruction + "'";
    }
    if (expirykubun != "すべて"){
      where += " and expirykubun = '" + expirykubun + "'";
    }
    if (expirydate != "すべて"){
      var datetime = new Date();
      where += " and expirydate is not null and expirydate >= '" + formaDate(datetime) + "'";
    }
    if (teaminal_id != ""){
      where += " and teaminal_id = '" + teaminal_id + "'";
    }
    requestLayer.definitionExpression = where;
    
    
    var query = requestLayer.createQuery();
    query.where = where;
    query.returnGeometry = false;
    query.outFields = [
      "orderNo"
    ];
    query.groupByFieldsForStatistics = "orderNo";
    query.orderByFields = "orderNo desc";

    query.outStatistics = [
      {
        statisticType: "count",
        onStatisticField: "ObjectId",
        outStatisticFieldName: "count"
      },
      {
        statisticType: "min",
        onStatisticField: "ObjectId",
        outStatisticFieldName: "min_oid"
      }
    ]
    
    var response = await requestLayer.queryFeatures(query);
    var features = response.features;

    var results = [];
    for (var i = 0; i< features.length; i++) {
      var orderNo = features[i].attributes["orderNo"];
      var count = features[i].attributes["count"];
      var oid = features[i].attributes["min_oid"];
      var where = "OBJECTID=" + oid;
      var details = await getOrderDetailList(where);
      
      var instruction = "";
      var expirykubun = "";
      var expirydate = "";
      var teaminal_id = "";
      var geometry = null;
      
      if (details.length == 1){
        instruction = details[0].attributes["instruction"];
        expirykubun = details[0].attributes["expirykubun"];
        expirydate = details[0].attributes["expirydate"];
        teaminal_id = details[0].attributes["teaminal_id"];
        geometry = JSON.stringify(details[0].geometry);
      }
      
      results.push({
        "orderNo": orderNo,
        "count": count,
        "instruction": instruction,
        "expirykubun": expirykubun,
        "expirydate": expirydate,
        "teaminal_id": teaminal_id,
        "geometry": geometry
      });
    }
    
    return results;
  }

  //指令番号ごとのデータを取得
  async function getOrderDetailList(where) {

    var query = requestLayer.createQuery();
    query.where = where;
    query.returnGeometry = true;
    query.outFields = "*";
    query.orderByFields = "OBJECTID";
    
    var response = await requestLayer.queryFeatures(query);
    var features = response.features;

    if (features.length == 0) {
      features = [];
    }
    return features;
  }
  
  //新しい指令番号を取得
  async function getNewOrderNo() {

    var query = requestLayer.createQuery();
    query.where = "1=1";
    query.returnGeometry = false;
    query.outFields = [
      "orderNo"
    ];
    query.outStatistics = [
      {
        statisticType: "max",
        onStatisticField: "orderNo",
        outStatisticFieldName: "max_orderNo"
      }
    ]
    
    var response = await requestLayer.queryFeatures(query);
    var features = response.features;

    var orderNo = 1;
    if (features.length > 0) {
      var no = features[0].attributes["max_orderNo"];
      if (no != null) {
        orderNo = Number(no) + 1;
      }
    }
    
    return orderNo;
  }
  
  //結果データのOBJECTIDを取得
  async function getResponseOids(layer) {
    
    var datetimeselect = document.getElementById('t3_datetimeselect').value;
    var filterselect = document.getElementById('t3_filterselect').value;
    var selectLayer = document.getElementById('t3_selectLayer').value;
    var radius = document.getElementById('t3_radius-slider').value;
    
    var datetime_field = "scene_datetime";
    var featureLayer = inferenceLayer;
    if (layer == "推論") {
      datetime_field = "scene_datetime";
      featureLayer = inferenceLayer;
    } else if (layer == "指示") {
      datetime_field = "datetime";
      featureLayer = orderResLayer;
    }
    
    var where = "1=1";
    if (datetimeselect == "本日") {
      where += " and " + datetime_field + " = '" + getAddDate(0) + "'";
    } else if (datetimeselect == "前日") {
      where += " and " + datetime_field + " >= '" + getAddDate(-1) + "'";
    } else if (datetimeselect == "1週間") {
      where += " and " + datetime_field + " >= '" + getAddDate(-7) + "'";
    }
    
    var query = featureLayer.createQuery();
    query.where = where;
    
    if (filterselect == "空間条件") {
      var geometrys = await getFacilityGeometry(selectLayer);
      
      var unions = [];
      const page = Math.ceil(geometrys.length / 2000);
      for (var i=0;i<page;i++) {
        let start = i * 2000;
        let end = (i + 1) * 2000;
        if (end > geometrys.length) {
          end = geometrys.length;
        }
        unions.push(geometryEngine.union(geometrys.slice(start, end)));
      }
      var merge_union = geometryEngine.union(unions);
      query.geometry = merge_union;
      query.distance = radius;
      query.units = "meters";
      query.spatialRelationship = "intersects";
    }
    
    query.returnGeometry = false;
    query.outFields = ["OBJECTID"];
    
    var response = await featureLayer.queryFeatures(query);
    var features = response.features;

    var oids = [];
    for (var i = 0; i< features.length; i++) {
      var oid = features[i].attributes["OBJECTID"];
      oids.push(String(oid));
    }
    return oids;
  }
  
  async function getFacilityGeometry(selectLayer) {
    
    var featureLayer = poleLayer;
    
    if (selectLayer == "電柱") {
      featureLayer = poleLayer;
    } else if (selectLayer == "高圧送電線") {
      featureLayer = socialTowerLayer;
    }
    
    var query = featureLayer.createQuery();
    query.where = "1=1";
    query.maxRecordCountFactor = 5;
    query.returnGeometry = true;
    query.outFields = ["OBJECTID"];
    
    var response = await featureLayer.queryFeatures(query);
    var features = response.features;
    
    var geometrys = [];
    for (var i = 0; i< features.length; i++) {
      var geometry = features[i].geometry;
      geometrys.push(geometry);
    }
    
    return geometrys;
  }
  
  function drawGraphicSpatialBuffer(geometrys, radius) {
    
    const page = Math.ceil(geometrys.length / 2000);
    for (var i=0;i<page;i++) {
      let start = i * 2000;
      let end = (i + 1) * 2000;
      if (end > geometrys.length) {
        end = geometrys.length;
      }

      let union = geometryEngine.union(geometrys.slice(start, end));
      let bGeometry = geometryEngine.geodesicBuffer(union, radius, "meters");

      let selectGraphic = new Graphic({
        geometry: bGeometry,
        symbol: buffermarkerSymbol
      });
      main_mapview.graphics.push(selectGraphic);
    }
  }
  
  //指令登録フォームの初期化
  function reset_form(id) {
    main_mapview.graphics.removeAll();
    current_centerPoint = null;
    
    
    //指令登録タブのクリア
    query_intrfeatures();
    const listNode = document.getElementById("t2_facility_list");
    const fragment = document.createDocumentFragment();
    listNode.innerHTML = "";
    const li = document.createElement("li");
    //li.textContent = "地点を入力してください";
    fragment.appendChild(li);
    listNode.appendChild(fragment);
    
    document.getElementById('t2_radius-slider').value = "100";
    document.getElementById('t2_radius-value').innerText = "100";
    document.getElementById('t2_facility_count').innerText = "";
    document.getElementById('t2_instruction').value = "写真撮影";
    document.getElementById('t2_expirykubun').value = "指定なし";
    document.getElementById('t2_expiryselect').value = "1日後";
    document.getElementById('t2_expirydate').value = getAddDate(1);
    document.getElementById('t2_teaminal_id').value = "";
    
    //$('#submitDiv').hide();
    $('#childscenForm').hide();
    
    //結果確認タブのクリア
    document.getElementById('t3_datetimeselect').value = "すべて";
    document.getElementById('t3_filterselect').value = "すべて";
    document.getElementById('t3_selectLayer').value = "電柱";
    document.getElementById('t3_radius-value').innerText = "0";
    document.getElementById('t3_radius-slider').value = "0";

    $('#t3_spatialFilterDiv').hide();

    
    //マップレイヤーの表示切り替え
    if (requestLayer == null || poleLayer == null || inferenceLayer == null || orderResLayer == null) {
      return;
    }
    requestLayer.refresh();
    
    if (id == 1) {
      requestLayer.visible = true;
      requestLayer.popupEnabled = true;
      poleLayer.visible = true;
      poleLayer.popupEnabled = true;
      responseLayer.visible = false;
      inferenceLayer.visible = true;
      orderResLayer.visible = true;
    } else if (id == 2) {
      requestLayer.visible = false;
      requestLayer.popupEnabled = false;
      poleLayer.visible = true;
      poleLayer.popupEnabled = false;
      responseLayer.visible = false;
      inferenceLayer.visible = true;
      orderResLayer.visible = true;
    } else if (id == 3) {
      requestLayer.visible = false;
      requestLayer.popupEnabled = true;
      poleLayer.visible = true;
      poleLayer.popupEnabled = true;
      responseLayer.visible = true;
      inferenceLayer.visible = true;
      orderResLayer.visible = true;
    }
    inferenceLayer.definitionExpression = "";
    orderResLayer.definitionExpression = "";
  }

  function formaDate(datetime) {
    let formatted_date = datetime.getFullYear() + "/" + (datetime.getMonth() + 1) + "/" + datetime.getDate() + " " + datetime.getHours() + ":" + datetime.getMinutes() + ":" + datetime.getSeconds();
    return formatted_date;
  }
  
  //指定の日付を指定する
  function getAddDate(days) {
    var date = new Date();
    date.setDate(date.getDate() + days);
    var year  = date.getFullYear();
    var month = date.getMonth() + 1;
    var day   = date.getDate();
    return String(year) + "-" + String(month) + "-" + String(day);
  }
});
