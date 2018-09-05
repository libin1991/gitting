import "./index.scss";
import "./primer-markdown.css";
import i18n from "./i18n";
import creatApi from "./creatApi";
import * as utils from "./utils";
import { version } from "../package.json";
import dayjs from "dayjs";
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
dayjs.extend(relativeTime);

class Gitting {
  constructor(option) {
    this.option = Object.assign({}, Gitting.DEFAULTS, option);
    this.api = creatApi(this.option);
    this.page = 1;
    this.issue = {};
    this.comments = [];
    this.token = utils.getStorage("gitting-token");
    this.userInfo = utils.getStorage("gitting-userInfo");
    this.isLogin = !!this.token && !!this.userInfo;
    this.i = i18n(this.option.language);
    this.creatInit = this.creatInit.bind(this);
    this.logout = this.logout.bind(this);
    dayjs.locale(this.option.language);
  }

  // 默认配置
  static get DEFAULTS() {
    return {
      clientID: "",
      clientSecret: "",
      repo: "",
      owner: "",
      id: location.pathname,
      number: -1,
      labels: ["Gitting"],
      title: document.title,
      body: `${document.title}\n${location.href}`,
      language: "zh-cn",
      perPage: 10,
      maxlength: 500,
      avatar: "https://assets-cdn.github.com/images/modules/logos_page/GitHub-Mark.png",
      proxy: "https://cors-anywhere.herokuapp.com/https://github.com/login/oauth/access_token"
    };
  }

  // 挂载
  async render(el) {
    this.$container = el instanceof Element ? el : utils.query(document, el);
    this.$container.innerHTML = '';

    // 初始化开始
    const loadend = utils.loading(el);

    // 检查是否需要登录
    const { code } = utils.getURLParameters();
    if (code) {
      await this.getUserInfo(code);
    }

    console.log('q')
    // 获取 issue
    if (this.option.number > 0) {
      this.issue = await this.api.getIssueById(this.option.number);
      this.errorHandle(!this.issue || !this.issue.number, `Failed to get issue by id [${this.option.number}] , Do you want to initialize an new issue?`, this.creatInit);
      console.log('w')
    } else {
      const labels = this.option.labels.concat(this.option.id).join(",");
      console.log(labels)
      this.issue = (await this.api.getIssueByLabel(labels))[0];
      console.log(this.issue)
      this.errorHandle(!this.issue || !this.issue.number, `Failed to get issue by labels [${labels}] , Do you want to initialize an new issue?`, this.creatInit);
      console.log('e')
    }

    // 初始化结束
    loadend();

    // 创建结构
    console.log('r')
    await this.creatGitting();
    console.log('t')
    await this.creatComment();
    console.log('y')
    await this.eventBind();
  }

  // 获取并保存用户信息
  async getUserInfo(code) {
    // 移除code参数
    const parameters = utils.getURLParameters();
    delete parameters.code;
    const newUrl = location.href.split("?")[0] + (Object.keys(parameters) > 0 ? "?" : "") + utils.queryStringify(parameters);
    history.replaceState(null, "", newUrl);

    // 获取token
    const data = await this.api.getToken(code);
    this.errorHandle(!data.access_token, "Can not get token, Please login again!", this.logout);
    utils.setStorage("gitting-token", data.access_token);
    this.token = data.access_token;

    // 获取用户信息
    const userInfo = await this.api.getUserInfo(data.access_token);
    this.errorHandle(!userInfo.id, "Can not get user info, Please login again!", this.logout);
    utils.setStorage("gitting-userInfo", userInfo);
    this.userInfo = userInfo;

    // 修改登录状态
    this.isLogin = true;

    return userInfo;
  }

  // 初始化评论
  creatInit() {
    console.log(1)
    const query = {
      state: "Gitting",
      client_id: this.option.clientID,
      redirect_uri: location.href,
      scope: "public_repo"
    };

    console.log(2)
    this.$container.insertAdjacentHTML("beforeend",
      `
        <div class="gt-init">
          ${
            this.isLogin
              ? `<a class="gt-init-btn" href="#">${this.i('init')}</a>`
              : `<a class="gt-login" href="http://github.com/login/oauth/authorize?client_id=${utils.queryStringify(query)}">${this.i('login')}</a>`
          }
        </div>
      `
    );

    console.log(3)
    if (!this.isLogin) return;
    this.$init = utils.query(this.$container, '.gt-init-btn');
    this.$init.addEventListener('click', async e => {
      e.preventDefault();
      const loadend = utils.loading(this.$container);
      const detail = {
        title: this.option.title,
        body: this.option.body,
        labels: this.option.labels.concat(this.option.id)
      };
      const issue = await this.api.creatIssues(detail);
      this.errorHandle(!issue || !issue.number, `Create issue failed: ${JSON.stringify(detail)}`, loadend);
      location.reload();
    });
  }

  // 创建结构
  creatGitting() {
    console.log(4)
    const query = {
      state: "Gitting",
      client_id: this.option.clientID,
      redirect_uri: location.href,
      scope: "public_repo"
    };

    console.log(this)
    console.log(this.userInfo)
    console.log(this.userInfo.login)

    console.log(5)
    this.$container.insertAdjacentHTML("beforeend",
      `
      <div class="gt-header clearfix">
        <a href="${this.issue.html_url}" class="fl" target="_blank">
          ${this.issue.comments} ${this.i("counts")}
        </a>
        <div class="gt-mate fr clearfix">
          ${
            this.isLogin
              ? `<a href="${this.userInfo.html_url}" class="gt-name fl" target="_blank">${this.userInfo.login}</a><a href="#" class="gt-logout fl">${this.i("logout")}</a>`
              : `<a href="http://github.com/login/oauth/authorize?client_id=${utils.queryStringify(query)}" class="gt-login fl">${this.i("login")}</a>`
          }
          <a href="https://github.com/zhw2590582/gitting" class="fl" target="_blank">Gitting ${version}</a>
        </div>
      </div>
      <div class="gt-body">
        <div class="gt-avatar">
          <img src="${this.isLogin ? this.userInfo.avatar_url : this.option.avatar}" alt="@${this.userInfo.login}">
        </div>
        <div class="gt-editor">
            <div class="gt-markdown markdown-body"></div>
            <textarea placeholder="${this.i("leave")}" class="gt-textarea" maxlength="${this.option.maxlength}"></textarea>
            <div class="gt-tip clearfix">
                <a class="fl" href="https://guides.github.com/features/mastering-markdown/" target="_blank">${this.i("styling")}</a>
                <div class="fr">
                  <span class="gt-counts">0</span> / ${this.option.maxlength}
                </div>
            </div>
            <div class="gt-tool clearfix">
                <div class="gt-switch fl clearfix">
                    <span class="gt-write gt-btn fl active">${this.i("write")}</span>
                    <span class="gt-preview gt-btn fl">${this.i("preview")}</span>
                </div>
                ${
                  this.isLogin
                    ? `<button class="gt-send fr">${this.i("submit")}</button>`
                    : `<a class="gt-send fr" href="http://github.com/login/oauth/authorize?client_id=${utils.queryStringify(query)}">${this.i("login")}</a>`
                }
            </div>
          </div>
      </div>
      <div class="gt-comments"></div>
      <div class="gt-comments-load"></div>
    `
    );

    console.log(6)
    this.$editor = utils.query(this.$container, '.gt-editor');
    this.$markdown = utils.query(this.$container, '.gt-markdown');
    this.$textarea = utils.query(this.$container, '.gt-textarea');
    this.$counts = utils.query(this.$container, '.gt-counts');
    this.$comments = utils.query(this.$container, '.gt-comments');
    this.$commentsLoad = utils.query(this.$container, '.gt-comments-load');
  }

  // 加载评论
  async creatComment() {
    this.$commentsLoad.innerHTML = '';
    const loadend = utils.loading(this.$commentsLoad);
    const comments = await this.api.getComments(this.issue.number, this.page++)
    this.comments.push(...comments);
    const commentHtml = comments.map(item => this.commentTemplate(item)).join('');
    this.$comments.insertAdjacentHTML("beforeend", commentHtml);
    loadend();
    if (comments.length < this.option.perPage) {
      this.$commentsLoad.innerHTML = `<div class="gt-load-end">${this.i("loadEnd")}</div>`;
    } else {
      this.$commentsLoad.innerHTML = `<a class="gt-load-more" href="#">${this.i("loadMore")}</a>`;
    }
    return comments;
  }

  // 评论模板
  commentTemplate(item, add = false) {
    return `
      <div class="comments-item${add ? ' add' : ''}" data-id="${item.id}">
        <div class="gt-avatar">
          <img src="${item.user.avatar_url}" alt="@${item.user.login}">
        </div>
        <div class="gt-comment-content caret">
          <div class="gt-comment-body markdown-body">
            ${item.body_html}
          </div>
          <div class="gt-comment-mate clearfix">
            <a class="gt-comment-name fl" href="${item.user.html_url}" target="_blank">${item.user.login}</a>
            <span class="gt-comment-time fl" data-time="${item.created_at}">${this.i("published")} ${dayjs(item.created_at).fromNow()}</span>
            <a class="gt-comment-reply fr" href="#" target="_blank" data-id="${item.id}">${this.i("reply")}</a>
          </div>
        </div>
      </div>
    `
  }

  // 绑定事件
  eventBind() {
    // change事件
    const inputName = ["propertychange", "change", "click", "keyup", "input", "paste"];
    const inputFn = e => (this.$counts.innerHTML = this.$textarea.value.length);
    inputName.forEach(item => this.$textarea.addEventListener(item, inputFn));

    // 点击事件
    this.$container.addEventListener('click', async e => {
      const target = e.target;
      
      // 注销
      if (target.classList.contains('gt-logout')) {
        e.preventDefault();
        this.logout();
      }

      // 编写
      if (target.classList.contains('gt-write')) {
        this.$editor.classList.remove('gt-mode-preview');
        this.$markdown.innerHTML = '';
      }

      // 预览
      if (target.classList.contains('gt-preview')) {
        const loadend = utils.loading(this.$markdown);
        this.$editor.classList.add('gt-mode-preview');
        const text = this.$textarea.value;
        if (text.trim()) {
          const html = await this.api.mdToHtml(text);
          loadend();
          this.$markdown.innerHTML = html;
        } else {
          this.$markdown.innerHTML = this.i('noPreview');
          loadend();
        }
      }

      // 发送
      if (target.classList.contains('gt-send')) {
        const body = this.$textarea.value;
        if (!body.trim()) return;
        const loadend = utils.loading(this.$editor);
        const item = await this.api.creatComments(this.issue.number, body);
        loadend();
        this.errorHandle(!item || !item.id, `Comment failed!`);
        this.$textarea.value = '';
        this.$comments.insertAdjacentHTML("beforeend", this.commentTemplate(item, true));
        const last = utils.query(this.$container, `[data-id='${item.id}']`);
        utils.smoothScroll(last);
      }

      // 回复
      if (target.classList.contains('gt-comment-reply')) {
        e.preventDefault();
        const id = target.dataset.id;
        const comment = this.comments.find(item => item.id == id);
        const oldValue = this.$textarea.value;
        const markdowm = `${oldValue ? '\n' : ''}> @${comment.user.login}\n> ${comment.body}\n`;
        const newValue = oldValue + markdowm;
        if (newValue.length > this.option.maxlength) return;
        this.$textarea.value = newValue;
        inputFn(e)
        this.$textarea.focus();
        utils.smoothScroll(this.$textarea, -30);
      }

      // 加载
      if (target.classList.contains('gt-load-more')) {
        e.preventDefault();
        const comments = await this.creatComment();
        if (comments.length) {
          const last = utils.query(this.$container, `[data-id='${comments[0].id}']`);
          utils.smoothScroll(last, -100);
        }
      }
    });
  }

  // 登出
  logout() {
    this.page = 1;
    this.isLogin = false;
    utils.delStorage("gitting-token");
    utils.delStorage("gitting-userInfo");
    this.render(this.$container);
  }

  // 错误处理
  errorHandle(condition, err, callback) {
    if (!condition) return;
    utils.removeElement(".gt-error");
    utils.removeElement(".gt-loading");
    this.$container.insertAdjacentHTML("afterbegin", `<div class="gt-error">${err}</div>`);
    callback && callback();
    throw new TypeError(err);
  }
}

window.Gitting = Gitting;
export default Gitting;
