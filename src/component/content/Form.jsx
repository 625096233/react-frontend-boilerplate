
import React, { Component, PropTypes } from 'react';
import {
  Table, Button, Modal, Row, Col,
  /* 表单 */
  Form,        // 表单
  Input,       // 普通输入框: <input type="{T}" />
  InputNumber, // 数字输入框
  Checkbox,    // 多选框
  Radio,       // 单选框
  Cascader,    // 级联选择
  Transfer,    // 穿梭框
  Select,      // 选择器
  TreeSelect,  // 树选择
  Slider,      // 滑动输入条
  Switch,      // 开关
  DatePicker,  // 日期选择
  TimePicker,  // 时间选择
  Upload,      // 上传
} from 'antd';

import * as _ from 'lodash';
import moment from 'moment';

export const FormItem = Form.Item;

const MAX_SPAN = 24;


//// Form Helpers
export const formHelpers = {
  // See: http://react-component.github.io/form/examples/file-input.html
  getFileValueProps(value) {
    console.log('getFileValueProps:', value);
    if (value && value.target) {
      return { value: value.target.value };
    }
    return { value };
  },
  getValueFromFileEvent({ target }) {
    return { target };
  },
  makeOptionElements(options) {
    return options.map(function(item) {
      return <Option key={item[0]} value={String(item[0])}>{item[1]}</Option>;
    });
  }
};

//// Form Rules
export const formRules = {
  fileRequired(message) {
    return function(rule, value, callback) {
      console.log('checkFile:', value);
      if (!value || !value.target || !value.target.files
       || value.target.files.length == 0) {
         return callback(message);
      }
      callback();
    };
  },
  imageDimensions(dimensions) {
    if (!dimensions) return undefined;
    if (_.isObject(dimensions)) {
      dimensions = [dimensions];
    }

    return function(rule, value, callback) {
      if (!!value && !!value.target && !!value.target.files && value.target.files.length > 0) {
        let promises = [];
        for (var i = 0; i < value.target.files.length; i++) {
          promises.push(new Promise(function(resolve, reject) {
            const file = value.target.files[i];
            let fr = new FileReader;
            fr.onload = function() { // file is loaded
              let img = new Image;
              img.onload = function() {
                let matched = false;
                dimensions.forEach(function(dimension) {
                  if (dimension.width == img.width && dimension.height == img.height) {
                    matched = true;
                  }
                });
                if (!matched) {
                  reject(`尺寸不合法: 名字=${file.name}, 宽=${img.width}, 高=${img.height}`);
                } else {
                  resolve();
                }
              };
              img.src = fr.result; // is the data URL because called with readAsDataURL
            };
            fr.readAsDataURL(file);
          }));
        }
        Promise.all(promises).then(function() {
          callback();
        }).catch(function(error) {
          callback(error);
        });
      } else {
        callback();
      }
    };
  }
};


////////////////////////////////////////////////////////////////////////////////
//// Classes
////////////////////////////////////////////////////////////////////////////////

class FormRow {
  constructor(content) {
    if (!_.isArray(content)) {
      content = [content];
    }

    if (content.length == 0) {
      console.error('Got empty <FormRow>.');
    }

    if (_.isString(content[0])) {
      const span = Math.floor(MAX_SPAN / content.length);
      this.cols = content.map(function(name) {
        return { name: name, span: span };
      });
    } else {
      this.cols = content;
    }

    /* console.log('columns:', this.cols); */
    /* Check column */
    this.cols.forEach(function(col) {
      if (!_.isString(col.name) || !_.isNumber(col.span)) {
        console.error('Invalid column:', col);
      }
    });
  }

  renderFormItem(context, name) {
    const { form, items, labelCol, wrapperCol } = context.props;
    const util = {
      form: form,
      field: name,
      itemProps: {
        key: `field-${name}`,
        labelCol: { span: labelCol },
        wrapperCol: { span: wrapperCol },
      }
    };
    // console.log('>>> util', util, '>>> context:', context);
    const item = items[name];
    const render = _.isFunction(item) ? item : item.render;
    return render.bind(context)(util);
  }

  render(context, key) {
    if (this.cols.length == 1  && this.cols[0].span == MAX_SPAN) {
      return this.renderFormItem(context, this.cols[0].name);
    } else {
      const columns = this.cols.map((col) => {
        const formItem = this.renderFormItem(context, col.name);
        let colProps = { key: col.name, span: col.span };
        if (_.isNumber(col.offset)) {
          colProps.offset = col.offset;
        }
        return <Col {...colProps}>{ formItem }</Col>;
      });
      return <Row key={key}>{ columns }</Row>;
    }
  }
}


export class BaseForm extends Component {

  static propTypes = {
    type       : PropTypes.oneOf(["create", "update"]).isRequired,
    labelCol   : PropTypes.number,
    wrapperCol : PropTypes.number,
    formProps  : PropTypes.object,
    fields     : PropTypes.oneOfType(
      [PropTypes.array, PropTypes.func]).isRequired,
    layout     : PropTypes.oneOfType(
      [PropTypes.array, PropTypes.func]),
    items      : PropTypes.object.isRequired,
    object     : PropTypes.object,
    onSubmit   : PropTypes.func, /* function(values, callback) or function(context, values, callback) */
    onSuccess  : PropTypes.func, /* function(object) */
  }

  static defaultProps = {
    labelCol   : 6,
    wrapperCol : 14,
    formProps  : {horizontal: true},
    layout     : null,
    object     : {},
    onSuccess  : function(object) {}
  }


  constructor(props) {
    super(props);
    console.log('BaseForm.constructor, props.object=',
                JSON.stringify(this.props.object));
    this.state = {object: this.props.object};
  }

  componentDidMount() {
    this.resetForm();
  }

  componentWillReceiveProps(newProps) {
    console.log('componentWillReceiveProps', this.props.type, newProps);
    if (!_.isEqual(newProps.object, this.props.object)) {
      this.setState({object: newProps.object}, () => {
        this.resetForm();
      });
    }
  }

  getFields() {
    const { fields } = this.props;
    return _.isFunction(fields) ? fields.call(this) : fields;
  }

  getLayout() {
    const { layout } = this.props;
    return _.isFunction(layout) ? layout.call(this) : (
      !!layout ? layout : this.getFields());
  }

  formatObject(object) {
    console.log('formatObject:', object);
    let result = {};
    const { items } = this.props;
    const fields = this.getFields();
    fields.map(function(field) {
      const item = items[field];
      let value = object[field];
      if (_.isBoolean(value)) {
        value = value ? '1' : '0';
      } else if (_.isNumber(value)) {
        value = String(value);
      } else if (_.isObject(item) && item.type === "file") {
        value = undefined;
      }
      result[field] = value;
    });
    console.log('>>> fields:', fields, 'result', result);
    return result;
  }

  handleReset() {
    const { type, object, form } = this.props
    form.resetFields();
    console.log('setFieldDefaults', type, object, this.state.object);
    const targetObject = type === "create" ? object : this.state.object;
    form.setFieldsValue(this.formatObject(targetObject));
  }
  resetForm() { this.handleReset() }

  handleSubmit(e) {
    console.log('BaseForm.handleSubmit', e);
    e.preventDefault();
    const { type, items, form, onSuccess, object } = this.props;
    const fields = this.getFields();
    form.validateFieldsAndScroll((errors, values) => {
      if (!!errors) {
        console.log('Errors in form!!!', errors);
        return;
      }

      // preprocess values
      if (object.id !== undefined) {
        values.id = object.id;
      }
      fields.forEach(function(field) {
        const item = items[field];
        const value = values[field];
        switch (item.type) {
          case "date":
            if (!!value ) {
              values[field] = moment(value).format('YYYY-MM-DD');
            }
            break;
          case "file":
            if (_.isObject(item) && value) {
              values[field] = value.target.files;
            }
            break;
          default:
            break;
        }
      });

      const callback = (newObject) => {
        if (type === "create") {
          this.handleReset();
          onSuccess();
        } else {
          this.setState({object: newObject}, () => {
            this.handleReset();
            onSuccess(newObject);
          });
        }
      };

      if (!!this.onSubmit) {
        this.onSubmit(values, callback);
      } else {
        this.props.onSubmit(this, values, callback);
      }
      console.log('Submit!!!', values);
    });
  }

  renderFormBody() {
    const { form, items, labelCol, wrapperCol } = this.props;
    /* console.log('renderFormBody:', JSON.stringify([
       this.props.type, this.state.object, this.props.object])); */
    const rows = this.getLayout();  // rows == layout
    /* console.log('renderFormBody.fields:', this.props.type, fields); */
    return rows.map((row, index) => {
      if (!(row instanceof FormRow)) {
        row = new FormRow(row);
      }
      return row.render(this, `row-${index}`);
    });
  }

  render() {
    const { form, formProps, labelCol, wrapperCol } = this.props;
    const footerItem = <FormItem key="_footer" wrapperCol={{ span: wrapperCol, offset: labelCol }}>
      <Button className="list-btn" type="primary" onClick={this.handleSubmit.bind(this)}>提交</Button>
      <Button className="list-btn" type="ghost" onClick={this.handleReset.bind(this)}>重置</Button>
    </FormItem>;
    let formBody = this.renderFormBody();
    formBody.push(footerItem);

    return (
      <Form form={form} onSubmit={e => this.handleSubmit(e)}
            {...formProps}>
        {formBody}
      </Form>
    );
  }
}


export class FormModal extends BaseForm {

  static propTypes = {
    ...BaseForm.propTypes,
    visible    : PropTypes.bool.isRequired,
    title      : PropTypes.string,
    modalProps : PropTypes.object,
    onCancel   : PropTypes.func, /* function() */
  }

  static defaultProps = {
    ...BaseForm.defaultProps,
    title: "表单",
    modalProps: {}
  }


  render() {
    const { form, formProps, modalProps } = this.props;
    const formBody = this.renderFormBody();
    const footer = <div>
        <Button type="ghost" onClick={e => this.handleReset()}>重置</Button>
        <Button type="primary" onClick={e => this.handleSubmit(e)}>提交</Button>
    </div>;

    return (
      <Modal title={this.props.title}
             visible={this.props.visible}
             footer={footer}
             onCancel={e => this.props.onCancel()}
             {...modalProps}>
        <Form form={form} onSubmit={e => this.handleSubmit(e)}
              {...formProps} >
          {formBody}
        </Form>
      </Modal>
    );
  }
}


export class SearchForm extends BaseForm {
  static propTypes = {
    ...BaseForm.propTypes,
    visible : PropTypes.bool.isRequired,
  }

  static defaultProps = {
    ...BaseForm.defaultProps,
    type: "update",
    labelCol: 10,
    wrapperCol: 14,
  }

  handleReset(e) {
    const { form, object } = this.props;
    let targetObject = object;
    if (!e) {
      targetObject = this.state.object;
    }
    form.setFieldsValue(this.formatObject(targetObject));
  }

  render() {
    if (!this.props.visible) {
      return null;
    }

    const { form, formProps, animProps } = this.props;
    const footerItem = (
      <Row key="_footer">
        <Col span="12" offset="12" style={{ textAlign: 'right' }}>
          <Button className="list-btn" type="primary" htmlType="submit"
                  onClick={this.handleSubmit.bind(this)}>搜索</Button>
          <Button className="list-btn" type="ghost" onClick={this.handleReset.bind(this)}>清除条件</Button>
        </Col>
      </Row>
    );
    let formBody = this.renderFormBody();
    formBody.push(footerItem);

    return (
      <Form form={form} onSubmit={e => this.handleSubmit(e)}
            className="advanced-search-form"
            {...formProps}>
        {formBody}
      </Form>
    );
  }
}
